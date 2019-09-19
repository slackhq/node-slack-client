/// <reference lib="esnext.asynciterable" />

import { Agent } from 'http';
import { basename } from 'path';
import { Readable } from 'stream';
import { SecureContextOptions } from 'tls';

import { EventEmitter } from 'eventemitter3';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

import Method, * as methods from './methods';
import { getUserAgent } from './instrument';
import {
  requestErrorWithOriginal, httpErrorFromResponse, platformErrorFromResult, rateLimitedErrorWithDelay,
} from './errors';
import { LogLevel, Logger, getLogger } from './logger';
import { tenRetriesInAboutThirtyMinutes, RetryOptions } from './retry-policies';
import { delay } from './helpers';

import isStream = require('is-stream');
import PQueue = require('p-queue');
import pRetry = require('p-retry');
import FormData = require('form-data');

// polyfill for async iterable. see: https://stackoverflow.com/a/43694282/305340
// can be removed once node v10 is the minimum target (node v8 and v9 require --harmony_async_iteration flag)
// eslint-disable-next-line dot-notation,@typescript-eslint/no-explicit-any
if (Symbol['asyncIterator'] === undefined) { ((Symbol as any)['asyncIterator']) = Symbol.for('asyncIterator'); }

/**
 * A client for Slack's Web API
 *
 * This client provides an alias for each {@link https://api.slack.com/methods|Web API method}. Each method is
 * a convenience wrapper for calling the {@link WebClient#apiCall} method using the method name as the first parameter.
 */
export class WebClient extends EventEmitter<WebClientEvent> {
  /**
   * The base URL for reaching Slack's Web API. Consider changing this value for testing purposes.
   */
  public readonly slackApiUrl: string;

  /**
   * Authentication and authorization token for accessing Slack Web API (usually begins with `xoxp` or `xoxb`)
   */
  public readonly token?: string;

  /**
   * Configuration for retry operations. See {@link https://github.com/tim-kos/node-retry|node-retry} for more details.
   */
  private retryConfig: RetryOptions;

  /**
   * Queue of requests in which a maximum of {@link WebClientOptions.maxRequestConcurrency} can concurrently be
   * in-flight.
   */
  private requestQueue: PQueue;

  /**
   * Axios HTTP client instance used by this client
   */
  private axios: AxiosInstance;

  /**
   * Configuration for custom TLS handling
   */
  private tlsConfig: TLSOptions;

  /**
   * Preference for immediately rejecting API calls which result in a rate-limited response
   */
  private rejectRateLimitedCalls: boolean;

  /**
   * The name used to prefix all logging generated from this object
   */
  private static loggerName = 'WebClient';

  /**
   * This object's logger instance
   */
  private logger: Logger;

  /**
   * @param token - An API token to authenticate/authorize with Slack (usually start with `xoxp`, `xoxb`)
   * @param options options to set
   */
  public constructor(token?: string, {
    slackApiUrl = 'https://slack.com/api/',
    logger = undefined,
    logLevel = LogLevel.INFO,
    maxRequestConcurrency = 3,
    retryConfig = tenRetriesInAboutThirtyMinutes,
    agent = undefined,
    tls = undefined,
    rejectRateLimitedCalls = false,
    headers = {},
  }: WebClientOptions = {}) {
    super();
    this.token = token;
    this.slackApiUrl = slackApiUrl;

    this.retryConfig = retryConfig;
    this.requestQueue = new PQueue({ concurrency: maxRequestConcurrency });
    // NOTE: may want to filter the keys to only those acceptable for TLS options
    this.tlsConfig = tls !== undefined ? tls : {};
    this.rejectRateLimitedCalls = rejectRateLimitedCalls;

    // Logging
    this.logger = getLogger(WebClient.loggerName, logLevel, logger);

    this.axios = axios.create({
      baseURL: slackApiUrl,
      headers: Object.assign(
        {
          'User-Agent': getUserAgent(),
        },
        headers,
      ),
      httpAgent: agent,
      httpsAgent: agent,
      transformRequest: [this.serializeApiCallOptions.bind(this)],
      validateStatus: () => true, // all HTTP status codes should result in a resolved promise (as opposed to only 2xx)
      maxRedirects: 0,
      // disabling axios' automatic proxy support:
      // axios would read from envvars to configure a proxy automatically, but it doesn't support TLS destinations.
      // for compatibility with https://api.slack.com, and for a larger set of possible proxies (SOCKS or other
      // protocols), users of this package should use the `agent` option to configure a proxy.
      proxy: false,
    });
    // serializeApiCallOptions will always determine the appropriate content-type
    delete this.axios.defaults.headers.post['Content-Type'];

    this.logger.debug('initialized');
  }

  /**
   * Generic method for calling a Web API method
   *
   * @param method the Web API method to call {@see https://api.slack.com/methods}
   * @param options options
   */
  public async apiCall(method: string, options?: WebAPICallOptions): Promise<WebAPICallResult> {
    this.logger.debug(`apiCall('${method}') start`);

    if (typeof options === 'string' || typeof options === 'number' || typeof options === 'boolean') {
      throw new TypeError(`Expected an options argument but instead received a ${typeof options}`);
    }

    const response = await this.makeRequest(method, Object.assign(
      { token: this.token },
      options,
    ));
    const result = this.buildResult(response);

    // log warnings in response metadata
    if (result.response_metadata !== undefined && result.response_metadata.warnings !== undefined) {
      result.response_metadata.warnings.forEach(this.logger.warn.bind(this.logger));
    }

    if (!result.ok) {
      throw platformErrorFromResult(result as (WebAPICallResult & { error: string }));
    }

    return result;
  }

  /**
   * Iterate over the result pages of a cursor-paginated Web API method. This method can return two types of values,
   * depending on which arguments are used. When up to two parameters are used, the return value is an async iterator
   * which can be used as the iterable in a for-await-of loop. When three or four parameters are used, the return
   * value is a promise that resolves at the end of iteration. The third parameter, `shouldStop`, is a function that is
   * called with each `page` and can end iteration by returning `true`. The fourth parameter, `reduce`, is a function
   * that is called with three arguments: `accumulator`, `page`, and `index`. The `accumulator` is a value of any type
   * you choose, but it will contain `undefined` when `reduce` is called for the first time. The `page` argument and
   * `index` arguments are exactly what they say they are. The `reduce` function's return value will be passed in as
   * `accumulator` the next time its called, and the returned promise will resolve to the last value of `accumulator`.
   *
   * The for-await-of syntax is part of ES2018. It is available natively in Node starting with v10.0.0. You may be able
   * to use it in earlier JavaScript runtimes by transpiling your source with a tool like Babel. However, the
   * transpiled code will likely sacrifice performance.
   *
   * @param method the cursor-paginated Web API method to call {@see https://api.slack.com/docs/pagination}
   * @param options options
   * @param shouldStop a predicate that is called with each page, and should return true when pagination can end.
   * @param reduce a callback that can be used to accumulate a value that the return promise is resolved to
   */
  public paginate(method: string, options?: WebAPICallOptions): AsyncIterator<WebAPICallResult>;

  // eslint-disable-next-line jsdoc/require-jsdoc
  public paginate(
    method: string,
    options: WebAPICallOptions,
    shouldStop: PaginatePredicate,
  ): Promise<void>;

  // eslint-disable-next-line jsdoc/require-jsdoc
  public paginate<R extends PageReducer, A extends PageAccumulator<R>>(
    method: string,
    options: WebAPICallOptions,
    shouldStop: PaginatePredicate,
    reduce?: PageReducer<A>,
  ): Promise<A>;

  // eslint-disable-next-line jsdoc/require-jsdoc
  public paginate<R extends PageReducer, A extends PageAccumulator<R>>(
    method: string,
    options?: WebAPICallOptions,
    shouldStop?: PaginatePredicate,
    reduce?: PageReducer<A>,
  ): (Promise<A> | AsyncIterator<WebAPICallResult>) {
    if (!methods.cursorPaginationEnabledMethods.has(method)) {
      this.logger.warn(`paginate() called with method ${method}, which is not known to be cursor pagination enabled.`);
    }

    const pageSize = (() => {
      if (options !== undefined && typeof options.limit === 'number') {
        const { limit } = options;
        delete options.limit;
        return limit;
      }
      return defaultPageSize;
    })();

    /**
     * Generates a set of web api calls
     * @param this client being bound to
     */
    async function* generatePages(this: WebClient): AsyncIterableIterator<WebAPICallResult> {
      // when result is undefined, that signals that the first of potentially many calls has not yet been made
      let result: WebAPICallResult | undefined = undefined;
      // paginationOptions stores pagination options not already stored in the options argument
      let paginationOptions: methods.CursorPaginationEnabled | undefined = {
        limit: pageSize,
      };
      if (options !== undefined && options.cursor !== undefined) {
        paginationOptions.cursor = options.cursor as string;
      }

      // NOTE: test for the situation where you're resuming a pagination using and existing cursor

      while (result === undefined || paginationOptions !== undefined) {
        // eslint-disable-next-line no-await-in-loop
        result = await this.apiCall(method, Object.assign(options !== undefined ? options : {}, paginationOptions));
        yield result;
        paginationOptions = paginationOptionsForNextPage(result, pageSize);
      }
    }

    if (shouldStop === undefined) {
      return generatePages.call(this);
    }

    const pageReducer: PageReducer<A> = (reduce !== undefined) ? reduce : noopPageReducer;
    let index = 0;

    return (async () => {
      // Unroll the first iteration of the iterator
      // This is done primarily because in order to satisfy the type system, we need a variable that is typed as A
      // (shown as accumulator before), but before the first iteration all we have is a variable typed A | undefined.
      // Unrolling the first iteration allows us to deal with undefined as a special case.

      const pageIterator: AsyncIterableIterator<WebAPICallResult> = generatePages.call(this);
      const firstIteratorResult = await pageIterator.next(undefined);
      // Assumption: there will always be at least one result in a paginated API request
      // if (firstIteratorResult.done) { return; }
      const firstPage = firstIteratorResult.value;
      let accumulator: A = pageReducer(undefined, firstPage, index);
      index += 1;
      if (shouldStop(firstPage)) {
        return accumulator;
      }

      // Continue iteration
      for await (const page of pageIterator) {
        accumulator = pageReducer(accumulator, page, index);
        if (shouldStop(page)) {
          return accumulator;
        }
        index += 1;
      }
      return accumulator;
    })();
  }

  /**
   * admin method family
   */
  public readonly admin = {
    apps: {
      approve: (this.apiCall.bind(this, 'admin.apps.approve')) as Method<methods.AdminAppsApproveArguments>,
      requests: {
        list: (this.apiCall.bind(this, 'admin.apps.requests.list')) as Method<methods.AdminAppsRequestsListArguments>,
      },
      restrict: (this.apiCall.bind(this, 'admin.apps.restrict')) as Method<methods.AdminAppsRestrictArguments>,
    },
    users: {
      session: {
        reset:
          (this.apiCall.bind(this, 'admin.users.session.reset')) as Method<methods.AdminUsersSessionResetArguments>,
      },
    },
  };

  /**
   * api method family
   */
  public readonly api = {
    test: (this.apiCall.bind(this, 'api.test')) as Method<methods.APITestArguments>,
  };

  /**
   * auth method family
   */
  public readonly auth = {
    revoke: (this.apiCall.bind(this, 'auth.revoke')) as Method<methods.AuthRevokeArguments>,
    test: (this.apiCall.bind(this, 'auth.test')) as Method<methods.AuthTestArguments>,
  };

  /**
   * bots method family
   */
  public readonly bots = {
    info: (this.apiCall.bind(this, 'bots.info')) as Method<methods.BotsInfoArguments>,
  };

  /**
   * channels method family
   */
  public readonly channels = {
    archive: (this.apiCall.bind(this, 'channels.archive')) as Method<methods.ChannelsArchiveArguments>,
    create: (this.apiCall.bind(this, 'channels.create')) as Method<methods.ChannelsCreateArguments>,
    history: (this.apiCall.bind(this, 'channels.history')) as Method<methods.ChannelsHistoryArguments>,
    info: (this.apiCall.bind(this, 'channels.info')) as Method<methods.ChannelsInfoArguments>,
    invite: (this.apiCall.bind(this, 'channels.invite')) as Method<methods.ChannelsInviteArguments>,
    join: (this.apiCall.bind(this, 'channels.join')) as Method<methods.ChannelsJoinArguments>,
    kick: (this.apiCall.bind(this, 'channels.kick')) as Method<methods.ChannelsKickArguments>,
    leave: (this.apiCall.bind(this, 'channels.leave')) as Method<methods.ChannelsLeaveArguments>,
    list: (this.apiCall.bind(this, 'channels.list')) as Method<methods.ChannelsListArguments>,
    mark: (this.apiCall.bind(this, 'channels.mark')) as Method<methods.ChannelsMarkArguments>,
    rename: (this.apiCall.bind(this, 'channels.rename')) as Method<methods.ChannelsRenameArguments>,
    replies: (this.apiCall.bind(this, 'channels.replies')) as Method<methods.ChannelsRepliesArguments>,
    setPurpose: (this.apiCall.bind(this, 'channels.setPurpose')) as Method<methods.ChannelsSetPurposeArguments>,
    setTopic: (this.apiCall.bind(this, 'channels.setTopic')) as Method<methods.ChannelsSetTopicArguments>,
    unarchive: (this.apiCall.bind(this, 'channels.unarchive')) as Method<methods.ChannelsUnarchiveArguments>,
  };

  /**
   * chat method family
   */
  public readonly chat = {
    delete: (this.apiCall.bind(this, 'chat.delete')) as Method<methods.ChatDeleteArguments>,
    deleteScheduledMessage:
      (this.apiCall.bind(this, 'chat.deleteScheduledMessage')) as Method<methods.ChatDeleteScheduledMessageArguments>,
    getPermalink: (this.apiCall.bind(this, 'chat.getPermalink')) as Method<methods.ChatGetPermalinkArguments>,
    meMessage: (this.apiCall.bind(this, 'chat.meMessage')) as Method<methods.ChatMeMessageArguments>,
    postEphemeral: (this.apiCall.bind(this, 'chat.postEphemeral')) as Method<methods.ChatPostEphemeralArguments>,
    postMessage: (this.apiCall.bind(this, 'chat.postMessage')) as Method<methods.ChatPostMessageArguments>,
    scheduleMessage: (this.apiCall.bind(this, 'chat.scheduleMessage')) as Method<methods.ChatScheduleMessageArguments>,
    scheduledMessages: {
      list:
        (this.apiCall.bind(this, 'chat.scheduledMessages.list')) as Method<methods.ChatScheduledMessagesListArguments>,
    },
    unfurl: (this.apiCall.bind(this, 'chat.unfurl')) as Method<methods.ChatUnfurlArguments>,
    update: (this.apiCall.bind(this, 'chat.update')) as Method<methods.ChatUpdateArguments>,
  };

  /**
   * conversations method family
   */
  public readonly conversations = {
    archive: (this.apiCall.bind(this, 'conversations.archive')) as Method<methods.ConversationsArchiveArguments>,
    close: (this.apiCall.bind(this, 'conversations.close')) as Method<methods.ConversationsCloseArguments>,
    create: (this.apiCall.bind(this, 'conversations.create')) as Method<methods.ConversationsCreateArguments>,
    history: (this.apiCall.bind(this, 'conversations.history')) as Method<methods.ConversationsHistoryArguments>,
    info: (this.apiCall.bind(this, 'conversations.info')) as Method<methods.ConversationsInfoArguments>,
    invite: (this.apiCall.bind(this, 'conversations.invite')) as Method<methods.ConversationsInviteArguments>,
    join: (this.apiCall.bind(this, 'conversations.join')) as Method<methods.ConversationsJoinArguments>,
    kick: (this.apiCall.bind(this, 'conversations.kick')) as Method<methods.ConversationsKickArguments>,
    leave: (this.apiCall.bind(this, 'conversations.leave')) as Method<methods.ConversationsLeaveArguments>,
    list: (this.apiCall.bind(this, 'conversations.list')) as Method<methods.ConversationsListArguments>,
    members: (this.apiCall.bind(this, 'conversations.members')) as Method<methods.ConversationsMembersArguments>,
    open: (this.apiCall.bind(this, 'conversations.open')) as Method<methods.ConversationsOpenArguments>,
    rename: (this.apiCall.bind(this, 'conversations.rename')) as Method<methods.ConversationsRenameArguments>,
    replies: (this.apiCall.bind(this, 'conversations.replies')) as Method<methods.ConversationsRepliesArguments>,
    setPurpose:
      (this.apiCall.bind(this, 'conversations.setPurpose')) as Method<methods.ConversationsSetPurposeArguments>,
    setTopic: (this.apiCall.bind(this, 'conversations.setTopic')) as Method<methods.ConversationsSetTopicArguments>,
    unarchive: (this.apiCall.bind(this, 'conversations.unarchive')) as Method<methods.ConversationsUnarchiveArguments>,
  };

  /**
   * dialog method family
   */
  public readonly dialog = {
    open: (this.apiCall.bind(this, 'dialog.open')) as Method<methods.DialogOpenArguments>,
  };

  /**
   * dnd method family
   */
  public readonly dnd = {
    endDnd: (this.apiCall.bind(this, 'dnd.endDnd')) as Method<methods.DndEndDndArguments>,
    endSnooze: (this.apiCall.bind(this, 'dnd.endSnooze')) as Method<methods.DndEndSnoozeArguments>,
    info: (this.apiCall.bind(this, 'dnd.info')) as Method<methods.DndInfoArguments>,
    setSnooze: (this.apiCall.bind(this, 'dnd.setSnooze')) as Method<methods.DndSetSnoozeArguments>,
    teamInfo: (this.apiCall.bind(this, 'dnd.teamInfo')) as Method<methods.DndTeamInfoArguments>,
  };

  /**
   * emoji method family
   */
  public readonly emoji = {
    list: (this.apiCall.bind(this, 'emoji.list')) as Method<methods.EmojiListArguments>,
  };

  /**
   * files method family
   */
  public readonly files = {
    delete: (this.apiCall.bind(this, 'files.delete')) as Method<methods.FilesDeleteArguments>,
    info: (this.apiCall.bind(this, 'files.info')) as Method<methods.FilesInfoArguments>,
    list: (this.apiCall.bind(this, 'files.list')) as Method<methods.FilesListArguments>,
    revokePublicURL:
      (this.apiCall.bind(this, 'files.revokePublicURL')) as Method<methods.FilesRevokePublicURLArguments>,
    sharedPublicURL:
      (this.apiCall.bind(this, 'files.sharedPublicURL')) as Method<methods.FilesSharedPublicURLArguments>,
    upload: (this.apiCall.bind(this, 'files.upload')) as Method<methods.FilesUploadArguments>,
    comments: {
      delete: (this.apiCall.bind(this, 'files.comments.delete')) as Method<methods.FilesCommentsDeleteArguments>,
    },
    remote: {
      info: (this.apiCall.bind(this, 'files.remote.info')) as Method<methods.FilesRemoteInfoArguments>,
      list: (this.apiCall.bind(this, 'files.remote.list')) as Method<methods.FilesRemoteListArguments>,
      add: (this.apiCall.bind(this, 'files.remote.add')) as Method<methods.FilesRemoteAddArguments>,
      update: (this.apiCall.bind(this, 'files.remote.update')) as Method<methods.FilesRemoteUpdateArguments>,
      remove: (this.apiCall.bind(this, 'files.remote.remove')) as Method<methods.FilesRemoteRemoveArguments>,
      share: (this.apiCall.bind(this, 'files.remote.share')) as Method<methods.FilesRemoteShareArguments>,
    },
  };

  /**
   * groups method family
   */
  public readonly groups = {
    archive: (this.apiCall.bind(this, 'groups.archive')) as Method<methods.GroupsArchiveArguments>,
    create: (this.apiCall.bind(this, 'groups.create')) as Method<methods.GroupsCreateArguments>,
    createChild: (this.apiCall.bind(this, 'groups.createChild')) as Method<methods.GroupsCreateChildArguments>,
    history: (this.apiCall.bind(this, 'groups.history')) as Method<methods.GroupsHistoryArguments>,
    info: (this.apiCall.bind(this, 'groups.info')) as Method<methods.GroupsInfoArguments>,
    invite: (this.apiCall.bind(this, 'groups.invite')) as Method<methods.GroupsInviteArguments>,
    kick: (this.apiCall.bind(this, 'groups.kick')) as Method<methods.GroupsKickArguments>,
    leave: (this.apiCall.bind(this, 'groups.leave')) as Method<methods.GroupsLeaveArguments>,
    list: (this.apiCall.bind(this, 'groups.list')) as Method<methods.GroupsListArguments>,
    mark: (this.apiCall.bind(this, 'groups.mark')) as Method<methods.GroupsMarkArguments>,
    open: (this.apiCall.bind(this, 'groups.open')) as Method<methods.GroupsOpenArguments>,
    rename: (this.apiCall.bind(this, 'groups.rename')) as Method<methods.GroupsRenameArguments>,
    replies: (this.apiCall.bind(this, 'groups.replies')) as Method<methods.GroupsRepliesArguments>,
    setPurpose: (this.apiCall.bind(this, 'groups.setPurpose')) as Method<methods.GroupsSetPurposeArguments>,
    setTopic: (this.apiCall.bind(this, 'groups.setTopic')) as Method<methods.GroupsSetTopicArguments>,
    unarchive: (this.apiCall.bind(this, 'groups.unarchive')) as Method<methods.GroupsUnarchiveArguments>,
  };

  /**
   * im method family
   */
  public readonly im = {
    close: (this.apiCall.bind(this, 'im.close')) as Method<methods.IMCloseArguments>,
    history: (this.apiCall.bind(this, 'im.history')) as Method<methods.IMHistoryArguments>,
    list: (this.apiCall.bind(this, 'im.list')) as Method<methods.IMListArguments>,
    mark: (this.apiCall.bind(this, 'im.mark')) as Method<methods.IMMarkArguments>,
    open: (this.apiCall.bind(this, 'im.open')) as Method<methods.IMOpenArguments>,
    replies: (this.apiCall.bind(this, 'im.replies')) as Method<methods.IMRepliesArguments>,
  };

  /**
   * migration method family
   */
  public readonly migration = {
    exchange: (this.apiCall.bind(this, 'migration.exchange')) as Method<methods.MigrationExchangeArguments>,
  };

  /**
   * mpim method family
   */
  public readonly mpim = {
    close: (this.apiCall.bind(this, 'mpim.close')) as Method<methods.MPIMCloseArguments>,
    history: (this.apiCall.bind(this, 'mpim.history')) as Method<methods.MPIMHistoryArguments>,
    list: (this.apiCall.bind(this, 'mpim.list')) as Method<methods.MPIMListArguments>,
    mark: (this.apiCall.bind(this, 'mpim.mark')) as Method<methods.MPIMMarkArguments>,
    open: (this.apiCall.bind(this, 'mpim.open')) as Method<methods.MPIMOpenArguments>,
    replies: (this.apiCall.bind(this, 'mpim.replies')) as Method<methods.MPIMRepliesArguments>,
  };

  /**
   * oauth method family
   */
  public readonly oauth = {
    access: (this.apiCall.bind(this, 'oauth.access')) as Method<methods.OAuthAccessArguments>,
  };

  /**
   * pins method family
   */
  public readonly pins = {
    add: (this.apiCall.bind(this, 'pins.add')) as Method<methods.PinsAddArguments>,
    list: (this.apiCall.bind(this, 'pins.list')) as Method<methods.PinsListArguments>,
    remove: (this.apiCall.bind(this, 'pins.remove')) as Method<methods.PinsRemoveArguments>,
  };

  /**
   * reactions method family
   */
  public readonly reactions = {
    add: (this.apiCall.bind(this, 'reactions.add')) as Method<methods.ReactionsAddArguments>,
    get: (this.apiCall.bind(this, 'reactions.get')) as Method<methods.ReactionsGetArguments>,
    list: (this.apiCall.bind(this, 'reactions.list')) as Method<methods.ReactionsListArguments>,
    remove: (this.apiCall.bind(this, 'reactions.remove')) as Method<methods.ReactionsRemoveArguments>,
  };

  /**
   * reminders method family
   */
  public readonly reminders = {
    add: (this.apiCall.bind(this, 'reminders.add')) as Method<methods.RemindersAddArguments>,
    complete: (this.apiCall.bind(this, 'reminders.complete')) as Method<methods.RemindersCompleteArguments>,
    delete: (this.apiCall.bind(this, 'reminders.delete')) as Method<methods.RemindersDeleteArguments>,
    info: (this.apiCall.bind(this, 'reminders.info')) as Method<methods.RemindersInfoArguments>,
    list: (this.apiCall.bind(this, 'reminders.list')) as Method<methods.RemindersListArguments>,
  };

  /**
   * rtm method family
   */
  public readonly rtm = {
    connect: (this.apiCall.bind(this, 'rtm.connect')) as Method<methods.RTMConnectArguments>,
    start: (this.apiCall.bind(this, 'rtm.start')) as Method<methods.RTMStartArguments>,
  };

  /**
   * search method family
   */
  public readonly search = {
    all: (this.apiCall.bind(this, 'search.all')) as Method<methods.SearchAllArguments>,
    files: (this.apiCall.bind(this, 'search.files')) as Method<methods.SearchFilesArguments>,
    messages: (this.apiCall.bind(this, 'search.messages')) as Method<methods.SearchMessagesArguments>,
  };

  /**
   * stars method family
   */
  public readonly stars = {
    add: (this.apiCall.bind(this, 'stars.add')) as Method<methods.StarsAddArguments>,
    list: (this.apiCall.bind(this, 'stars.list')) as Method<methods.StarsListArguments>,
    remove: (this.apiCall.bind(this, 'stars.remove')) as Method<methods.StarsRemoveArguments>,
  };

  /**
   * team method family
   */
  public readonly team = {
    accessLogs: (this.apiCall.bind(this, 'team.accessLogs')) as Method<methods.TeamAccessLogsArguments>,
    billableInfo: (this.apiCall.bind(this, 'team.billableInfo')) as Method<methods.TeamBillableInfoArguments>,
    info: (this.apiCall.bind(this, 'team.info')) as Method<methods.TeamInfoArguments>,
    integrationLogs: (this.apiCall.bind(this, 'team.integrationLogs')) as Method<methods.TeamIntegrationLogsArguments>,
    profile: {
      get: (this.apiCall.bind(this, 'team.profile.get')) as Method<methods.TeamProfileGetArguments>,
    },
  };

  /**
   * usergroups method family
   */
  public readonly usergroups = {
    create: (this.apiCall.bind(this, 'usergroups.create')) as Method<methods.UsergroupsCreateArguments>,
    disable: (this.apiCall.bind(this, 'usergroups.disable')) as Method<methods.UsergroupsDisableArguments>,
    enable: (this.apiCall.bind(this, 'usergroups.enable')) as Method<methods.UsergroupsEnableArguments>,
    list: (this.apiCall.bind(this, 'usergroups.list')) as Method<methods.UsergroupsListArguments>,
    update: (this.apiCall.bind(this, 'usergroups.update')) as Method<methods.UsergroupsUpdateArguments>,
    users: {
      list: (this.apiCall.bind(this, 'usergroups.users.list')) as Method<methods.UsergroupsUsersListArguments>,
      update: (this.apiCall.bind(this, 'usergroups.users.update')) as Method<methods.UsergroupsUsersUpdateArguments>,
    },
  };

  /**
   * users method family
   */
  public readonly users = {
    conversations: (this.apiCall.bind(this, 'users.conversations')) as Method<methods.UsersConversationsArguments>,
    deletePhoto: (this.apiCall.bind(this, 'users.deletePhoto')) as Method<methods.UsersDeletePhotoArguments>,
    getPresence: (this.apiCall.bind(this, 'users.getPresence')) as Method<methods.UsersGetPresenceArguments>,
    identity: (this.apiCall.bind(this, 'users.identity')) as Method<methods.UsersIdentityArguments>,
    info: (this.apiCall.bind(this, 'users.info')) as Method<methods.UsersInfoArguments>,
    list: (this.apiCall.bind(this, 'users.list')) as Method<methods.UsersListArguments>,
    lookupByEmail: (this.apiCall.bind(this, 'users.lookupByEmail')) as Method<methods.UsersLookupByEmailArguments>,
    setPhoto: (this.apiCall.bind(this, 'users.setPhoto')) as Method<methods.UsersSetPhotoArguments>,
    setPresence: (this.apiCall.bind(this, 'users.setPresence')) as Method<methods.UsersSetPresenceArguments>,
    profile: {
      get: (this.apiCall.bind(this, 'users.profile.get')) as Method<methods.UsersProfileGetArguments>,
      set: (this.apiCall.bind(this, 'users.profile.set')) as Method<methods.UsersProfileSetArguments>,
    },
  };

  /**
   * Low-level function to make a single API request. handles queuing, retries, and http-level errors
   * @param url URL to request
   * @param body body to post
   * @param headers headers to set on the request
   */
  private async makeRequest(url: string, body: any, headers: any = {}): Promise<AxiosResponse> {
    // TODO: better input types - remove any
    const task = (): any => this.requestQueue.add(async () => {
      this.logger.debug('will perform http request');
      try {
        const response = await this.axios.post(url, body, Object.assign(
          {
            headers,
          },
          this.tlsConfig,
        ));
        this.logger.debug('http response received');

        if (response.status === 429) {
          const retrySec = parseRetryHeaders(response);
          if (retrySec !== undefined) {
            this.emit(WebClientEvent.RATE_LIMITED, retrySec);
            if (this.rejectRateLimitedCalls) {
              throw new pRetry.AbortError(rateLimitedErrorWithDelay(retrySec));
            }
            this.logger.info(`API Call failed due to rate limiting. Will retry in ${retrySec} seconds.`);
            // pause the request queue and then delay the rejection by the amount of time in the retry header
            this.requestQueue.pause();
            // NOTE: if there was a way to introspect the current RetryOperation and know what the next timeout
            // would be, then we could subtract that time from the following delay, knowing that it the next
            // attempt still wouldn't occur until after the rate-limit header has specified. an even better
            // solution would be to subtract the time from only the timeout of this next attempt of the
            // RetryOperation. this would result in the staying paused for the entire duration specified in the
            // header, yet this operation not having to pay the timeout cost in addition to that.
            await delay(retrySec * 1000);
            // resume the request queue and throw a non-abort error to signal a retry
            this.requestQueue.start();
            throw Error('A rate limit was exceeded.');
          } else {
            // TODO: turn this into some CodedError
            throw new pRetry.AbortError(new Error('Retry header did not contain a valid timeout.'));
          }
        }

        // Slack's Web API doesn't use meaningful status codes besides 429 and 200
        if (response.status !== 200) {
          throw httpErrorFromResponse(response);
        }

        return response;
      } catch (error) {
        this.logger.warn('http request failed', error.message);
        if (error.request) {
          throw requestErrorWithOriginal(error);
        }
        throw error;
      }
    });

    return pRetry(task, this.retryConfig);
  }

  /**
   * Transforms options (a simple key-value object) into an acceptable value for a body. This can be either
   * a string, used when posting with a content-type of url-encoded. Or, it can be a readable stream, used
   * when the options contain a binary (a stream or a buffer) and the upload should be done with content-type
   * multipart/form-data.
   *
   * @param options arguments for the Web API method
   * @param headers a mutable object representing the HTTP headers for the outgoing request
   */
  private serializeApiCallOptions(options: WebAPICallOptions, headers?: any): string | Readable {
    // The following operation both flattens complex objects into a JSON-encoded strings and searches the values for
    // binary content
    let containsBinaryData = false;
    const flattened = Object.entries(options)
      /* eslint-disable @typescript-eslint/indent */
      .map<[string, any] | []>(([key, value]) => {
        if (value === undefined || value === null) {
          return [];
        }

        let serializedValue = value;

        if (Buffer.isBuffer(value) || isStream(value)) {
          containsBinaryData = true;
        } else if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'boolean') {
          // if value is anything other than string, number, boolean, binary data, a Stream, or a Buffer, then encode it
          // as a JSON string.
          serializedValue = JSON.stringify(value);
        }

        return [key, serializedValue];
      });
      /* eslint-enable @typescript-eslint/indent */

    // A body with binary content should be serialized as multipart/form-data
    if (containsBinaryData) {
      this.logger.debug('request arguments contain binary data');
      const form = flattened.reduce(
        (f, [key, value]) => {
          if (Buffer.isBuffer(value) || isStream(value)) {
            const appendOptions: FormData.AppendOptions = {};
            appendOptions.filename = (() => {
              // attempt to find filename from `value`. adapted from:
              // https://github.com/form-data/form-data/blob/028c21e0f93c5fefa46a7bbf1ba753e4f627ab7a/lib/form_data.js#L227-L230
              // formidable and the browser add a name property
              // fs- and request- streams have path property
              const streamOrBuffer: any = (value as any);
              if (typeof streamOrBuffer.name === 'string') {
                return basename(streamOrBuffer.name);
              }
              if (typeof streamOrBuffer.path === 'string') {
                return basename(streamOrBuffer.path);
              }
              return defaultFilename;
            })();
            f.append(key as string, value, appendOptions);
          } else if (key !== undefined && value !== undefined) {
            f.append(key, value);
          }
          return f;
        },
        new FormData(),
      );
      // Copying FormData-generated headers into headers param
      // not reassigning to headers param since it is passed by reference and behaves as an inout param
      for (const [header, value] of Object.entries(form.getHeaders())) {
        headers[header] = value;
      }
      return form;
    }

    // Otherwise, a simple key-value object is returned
    headers['Content-Type'] = 'application/x-www-form-urlencoded';
    const initialValue: { [key: string]: any } = {};
    return (new URLSearchParams(flattened.reduce(
      (accumulator, [key, value]) => {
        if (key !== undefined && value !== undefined) {
          accumulator[key] = value;
        }
        return accumulator;
      },
      initialValue,
    ))).toString();
  }

  /**
   * Processes an HTTP response into a WebAPICallResult by performing JSON parsing on the body and merging relevent
   * HTTP headers into the object.
   * @param response - an http response
   */
  private buildResult(response: AxiosResponse): WebAPICallResult {
    const { data } = response;

    if (data.response_metadata === undefined) {
      // eslint-disable-next-line @typescript-eslint/camelcase
      data.response_metadata = {};
    }

    // add scopes metadata from headers
    if (response.headers['x-oauth-scopes'] !== undefined) {
      data.response_metadata.scopes = (response.headers['x-oauth-scopes'] as string).trim().split(/\s*,\s*/);
    }
    if (response.headers['x-accepted-oauth-scopes'] !== undefined) {
      data.response_metadata.acceptedScopes =
        (response.headers['x-accepted-oauth-scopes'] as string).trim().split(/\s*,\s*/);
    }

    // add retry metadata from headers
    const retrySec = parseRetryHeaders(response);
    if (retrySec !== undefined) {
      data.response_metadata.retryAfter = retrySec;
    }

    return data;
  }
}

export default WebClient;

/*
 * Exported types
 */

export interface WebClientOptions {
  slackApiUrl?: string;
  logger?: Logger;
  logLevel?: LogLevel;
  maxRequestConcurrency?: number;
  retryConfig?: RetryOptions;
  agent?: Agent;
  tls?: TLSOptions;
  rejectRateLimitedCalls?: boolean;
  headers?: object;
}

export type TLSOptions = Pick<SecureContextOptions, 'pfx' | 'key' | 'passphrase' | 'cert' | 'ca'>;

export enum WebClientEvent {
  RATE_LIMITED = 'rate_limited',
}

export interface WebAPICallOptions {
  [argument: string]: unknown;
}

export interface WebAPICallResult {
  ok: boolean;
  error?: string;
  response_metadata?: {
    warnings?: string[];
    next_cursor?: string; // is this too specific to be encoded into this type?

    // added from the headers of the http response
    scopes?: string[];
    acceptedScopes?: string[];
    retryAfter?: number;
    // `chat.postMessage` returns an array of error messages (e.g., "messages": ["[ERROR] invalid_keys"])
    messages?: string[];
  };
  [key: string]: unknown;
}

// NOTE: should there be an async predicate?
export interface PaginatePredicate {
  (page: WebAPICallResult): boolean | undefined | void;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface PageReducer<A = any> {
  (accumulator: A | undefined, page: WebAPICallResult, index: number): A;
}

type PageAccumulator<R extends PageReducer> =
  R extends (accumulator: (infer A) | undefined, page: WebAPICallResult, index: number) => infer A ? A : never;

/*
 * Helpers
 */

const defaultFilename = 'Untitled';
const defaultPageSize = 200;
const noopPageReducer: PageReducer = () => undefined;

/**
 * Determines an appropriate set of cursor pagination options for the next request to a paginated API method.
 * @param previousResult - the result of the last request, where the next cursor might be found.
 * @param pageSize - the maximum number of additional items to fetch in the next request.
 */
function paginationOptionsForNextPage(
  previousResult: WebAPICallResult | undefined, pageSize: number,
): methods.CursorPaginationEnabled | undefined {
  if (
    previousResult !== undefined &&
    previousResult.response_metadata !== undefined &&
    previousResult.response_metadata.next_cursor !== undefined &&
    previousResult.response_metadata.next_cursor !== ''
  ) {
    return {
      limit: pageSize,
      cursor: previousResult.response_metadata.next_cursor as string,
    };
  }
  return undefined;
}

/**
 * Extract the amount of time (in seconds) the platform has recommended this client wait before sending another request
 * from a rate-limited HTTP response (statusCode = 429).
 * @param response response to read headers from
 */
function parseRetryHeaders(response: AxiosResponse): number | undefined {
  if (response.headers['retry-after'] !== undefined) {
    const retryAfter = parseInt((response.headers['retry-after'] as string), 10);

    if (!Number.isNaN(retryAfter)) {
      return retryAfter;
    }
  }
  return undefined;
}
