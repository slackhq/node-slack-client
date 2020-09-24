import { Stream } from 'stream';
import { Dialog, View, KnownBlock, Block, MessageAttachment, LinkUnfurls, CallUser } from '@slack/types';
import { EventEmitter } from 'eventemitter3';
import { WebAPICallOptions, WebAPICallResult, WebClient, WebClientEvent } from './WebClient';

// NOTE: could create a named type alias like data types like `SlackUserID: string`

/**
 * Binds a certain `method` and its arguments and result types to the `apiCall` method in `WebClient`.
 */
function bindApiCall<Arguments extends WebAPICallOptions, Result extends WebAPICallResult>(
  self: Methods,
  method: string,
): Method<Arguments, Result> {
  // We have to "assert" that the bound method does indeed return the more specific `Result` type instead of just
  // `WebAPICallResult`
  return self.apiCall.bind(self, method) as Method<Arguments, Result>;
}

/**
 * A class that defines all Web API methods, their arguments type, their response type, and binds those methods to the
 * `apiCall` class method.
 */
export abstract class Methods extends EventEmitter<WebClientEvent> {
  // TODO: As of writing, `WebClient` already extends EventEmitter...
  // and I want WebClient to extend this class...
  // and multiple inheritance in JS is cursed...
  // so I'm just making this class extend EventEmitter.
  //
  // It shouldn't be here, indeed. Nothing here uses it, indeed. But it must be here for the sake of sanity.

  protected constructor() {
    super();

    // Check that the class being created extends from `WebClient` rather than this class
    if (new.target !== WebClient && !(new.target.prototype instanceof WebClient)) {
      throw new Error('Attempt to inherit from WebClient methods without inheriting from WebClient');
    }
  }

  public abstract async apiCall(method: string, options?: WebAPICallOptions): Promise<WebAPICallResult>;

  public readonly admin = {
    apps: {
      approve: bindApiCall<AdminAppsApproveArguments, WebAPICallResult>(this, 'admin.apps.approve'),
      approved: {
        list: bindApiCall<AdminAppsApprovedListArguments, WebAPICallResult>(this, 'admin.apps.approved.list'),
      },
      requests: {
        list: bindApiCall<AdminAppsRequestsListArguments, WebAPICallResult>(this, 'admin.apps.requests.list'),
      },
      restrict: bindApiCall<AdminAppsRestrictArguments, WebAPICallResult>(this, 'admin.apps.restrict'),
      restricted: {
        list: bindApiCall<AdminAppsRestrictedListArguments, WebAPICallResult>(this, 'admin.apps.restricted.list'),
      },
    },
    conversations: {
      setTeams: bindApiCall<AdminConversationsSetTeamsArguments, WebAPICallResult>(
        this,
        'admin.conversations.setTeams',
      ),
      restrictAccess: {
        addGroup: bindApiCall<AdminConversationsRestrictAccessAddGroupArguments, WebAPICallResult>(
          this,
          'admin.conversations.restrictAccess.addGroup',
        ),
        listGroups: bindApiCall<AdminConversationsRestrictAccessListGroupsArguments, WebAPICallResult>(
          this,
          'admin.conversations.restrictAccess.listGroups',
        ),
        removeGroup: bindApiCall<AdminConversationsRestrictAccessRemoveGroupArguments, WebAPICallResult>(
          this,
          'admin.conversations.restrictAccess.removeGroup',
        ),
      },
    },
    inviteRequests: {
      approve: bindApiCall<AdminInviteRequestsApproveArguments, WebAPICallResult>(this, 'admin.inviteRequests.approve'),
      deny: bindApiCall<AdminInviteRequestsDenyArguments, WebAPICallResult>(this, 'admin.inviteRequests.deny'),
      list: bindApiCall<AdminInviteRequestsListArguments, WebAPICallResult>(this, 'admin.inviteRequests.list'),
      approved: {
        list: bindApiCall<AdminInviteRequestsApprovedListArguments, WebAPICallResult>(
          this,
          'admin.inviteRequests.approved.list',
        ),
      },
      denied: {
        list: bindApiCall<AdminInviteRequestsDeniedListArguments, WebAPICallResult>(
          this,
          'admin.inviteRequests.denied.list',
        ),
      },
    },
    teams: {
      admins: {
        list: bindApiCall<AdminTeamsAdminsListArguments, WebAPICallResult>(this, 'admin.teams.admins.list'),
      },
      create: bindApiCall<AdminTeamsCreateArguments, WebAPICallResult>(this, 'admin.teams.create'),
      list: bindApiCall<AdminTeamsListArguments, WebAPICallResult>(this, 'admin.teams.list'),
      owners: {
        list: bindApiCall<AdminTeamsOwnersListArguments, WebAPICallResult>(this, 'admin.teams.owners.list'),
      },
      settings: {
        info: bindApiCall<AdminTeamsSettingsInfoArguments, WebAPICallResult>(this, 'admin.teams.settings.info'),
        setDefaultChannels: bindApiCall<AdminTeamsSettingsSetDefaultChannelsArguments, WebAPICallResult>(
          this,
          'admin.teams.settings.setDefaultChannels',
        ),
        setDescription: bindApiCall<AdminTeamsSettingsSetDescriptionArguments, WebAPICallResult>(
          this,
          'admin.teams.settings.setDescription',
        ),
        setDiscoverability: bindApiCall<AdminTeamsSettingsSetDiscoverabilityArguments, WebAPICallResult>(
          this,
          'admin.teams.settings.setDiscoverability',
        ),
        setIcon: bindApiCall<AdminTeamsSettingseSetIconArguments, WebAPICallResult>(
          this,
          'admin.teams.settings.setIcon',
        ),
        setName: bindApiCall<AdminTeamsSettingsSetNameArguments, WebAPICallResult>(
          this,
          'admin.teams.settings.setName',
        ),
      },
    },
    usergroups: {
      addChannels: bindApiCall<AdminUsergroupsAddChannelsArguments, WebAPICallResult>(
        this,
        'admin.usergroups.addChannels',
      ),
      addTeams: bindApiCall<AdminUsergroupsAddTeamsArguments, WebAPICallResult>(this, 'admin.usergroups.addTeams'),
      listChannels: bindApiCall<AdminUsergroupsListChannelsArguments, WebAPICallResult>(
        this,
        'admin.usergroups.listChannels',
      ),
      removeChannels: bindApiCall<AdminUsergroupsRemoveChannelsArguments, WebAPICallResult>(
        this,
        'admin.usergroups.removeChannels',
      ),
    },
    users: {
      session: {
        reset: bindApiCall<AdminUsersSessionResetArguments, WebAPICallResult>(this, 'admin.users.session.reset'),
      },
      assign: bindApiCall<AdminUsersAssignArguments, WebAPICallResult>(this, 'admin.users.assign'),
      invite: bindApiCall<AdminUsersInviteArguments, WebAPICallResult>(this, 'admin.users.invite'),
      list: bindApiCall<AdminUsersListArguments, WebAPICallResult>(this, 'admin.users.list'),
      remove: bindApiCall<AdminUsersRemoveArguments, WebAPICallResult>(this, 'admin.users.remove'),
      setAdmin: bindApiCall<AdminUsersSetAdminArguments, WebAPICallResult>(this, 'admin.users.setAdmin'),
      setExpiration: bindApiCall<AdminUsersSetExpirationArguments, WebAPICallResult>(this, 'admin.users.setExpiration'),
      setOwner: bindApiCall<AdminUsersSetOwnerArguments, WebAPICallResult>(this, 'admin.users.setOwner'),
      setRegular: bindApiCall<AdminUsersSetRegularArguments, WebAPICallResult>(this, 'admin.users.setRegular'),
    },
  };

  public readonly api = {
    test: bindApiCall<APITestArguments, WebAPICallResult>(this, 'api.test'),
  };

  public readonly auth = {
    revoke: bindApiCall<AuthRevokeArguments, WebAPICallResult>(this, 'auth.revoke'),
    test: bindApiCall<AuthTestArguments, WebAPICallResult>(this, 'auth.test'),
  };

  public readonly bots = {
    info: bindApiCall<BotsInfoArguments, WebAPICallResult>(this, 'bots.info'),
  };

  public readonly calls = {
    add: bindApiCall<CallsAddArguments, WebAPICallResult>(this, 'calls.add'),
    end: bindApiCall<CallsEndArguments, WebAPICallResult>(this, 'calls.end'),
    info: bindApiCall<CallsInfoArguments, WebAPICallResult>(this, 'calls.info'),
    update: bindApiCall<CallsUpdateArguments, WebAPICallResult>(this, 'calls.update'),
    participants: {
      add: bindApiCall<CallsParticipantsAddArguments, WebAPICallResult>(this, 'calls.participants.add'),
      remove: bindApiCall<CallsParticipantsRemoveArguments, WebAPICallResult>(this, 'calls.participants.remove'),
    },
  };

  public readonly channels = {
    archive: bindApiCall<ChannelsArchiveArguments, WebAPICallResult>(this, 'channels.archive'),
    create: bindApiCall<ChannelsCreateArguments, WebAPICallResult>(this, 'channels.create'),
    history: bindApiCall<ChannelsHistoryArguments, WebAPICallResult>(this, 'channels.history'),
    info: bindApiCall<ChannelsInfoArguments, WebAPICallResult>(this, 'channels.info'),
    invite: bindApiCall<ChannelsInviteArguments, WebAPICallResult>(this, 'channels.invite'),
    join: bindApiCall<ChannelsJoinArguments, WebAPICallResult>(this, 'channels.join'),
    kick: bindApiCall<ChannelsKickArguments, WebAPICallResult>(this, 'channels.kick'),
    leave: bindApiCall<ChannelsLeaveArguments, WebAPICallResult>(this, 'channels.leave'),
    list: bindApiCall<ChannelsListArguments, WebAPICallResult>(this, 'channels.list'),
    mark: bindApiCall<ChannelsMarkArguments, WebAPICallResult>(this, 'channels.mark'),
    rename: bindApiCall<ChannelsRenameArguments, WebAPICallResult>(this, 'channels.rename'),
    replies: bindApiCall<ChannelsRepliesArguments, WebAPICallResult>(this, 'channels.replies'),
    setPurpose: bindApiCall<ChannelsSetPurposeArguments, WebAPICallResult>(this, 'channels.setPurpose'),
    setTopic: bindApiCall<ChannelsSetTopicArguments, WebAPICallResult>(this, 'channels.setTopic'),
    unarchive: bindApiCall<ChannelsUnarchiveArguments, WebAPICallResult>(this, 'channels.unarchive'),
  };

  public readonly chat = {
    delete: bindApiCall<ChatDeleteArguments, WebAPICallResult>(this, 'chat.delete'),
    deleteScheduledMessage: bindApiCall<ChatDeleteScheduledMessageArguments, WebAPICallResult>(
      this,
      'chat.deleteScheduledMessage',
    ),
    getPermalink: bindApiCall<ChatGetPermalinkArguments, WebAPICallResult>(this, 'chat.getPermalink'),
    meMessage: bindApiCall<ChatMeMessageArguments, WebAPICallResult>(this, 'chat.meMessage'),
    postEphemeral: bindApiCall<ChatPostEphemeralArguments, WebAPICallResult>(this, 'chat.postEphemeral'),
    postMessage: bindApiCall<ChatPostMessageArguments, WebAPICallResult>(this, 'chat.postMessage'),
    scheduleMessage: bindApiCall<ChatScheduleMessageArguments, WebAPICallResult>(this, 'chat.scheduleMessage'),
    scheduledMessages: {
      list: bindApiCall<ChatScheduledMessagesListArguments, WebAPICallResult>(this, 'chat.scheduledMessages.list'),
    },
    unfurl: bindApiCall<ChatUnfurlArguments, WebAPICallResult>(this, 'chat.unfurl'),
    update: bindApiCall<ChatUpdateArguments, WebAPICallResult>(this, 'chat.update'),
  };

  public readonly conversations = {
    archive: bindApiCall<ConversationsArchiveArguments, WebAPICallResult>(this, 'conversations.archive'),
    close: bindApiCall<ConversationsCloseArguments, WebAPICallResult>(this, 'conversations.close'),
    create: bindApiCall<ConversationsCreateArguments, WebAPICallResult>(this, 'conversations.create'),
    history: bindApiCall<ConversationsHistoryArguments, WebAPICallResult>(this, 'conversations.history'),
    info: bindApiCall<ConversationsInfoArguments, WebAPICallResult>(this, 'conversations.info'),
    invite: bindApiCall<ConversationsInviteArguments, WebAPICallResult>(this, 'conversations.invite'),
    join: bindApiCall<ConversationsJoinArguments, WebAPICallResult>(this, 'conversations.join'),
    kick: bindApiCall<ConversationsKickArguments, WebAPICallResult>(this, 'conversations.kick'),
    leave: bindApiCall<ConversationsLeaveArguments, WebAPICallResult>(this, 'conversations.leave'),
    list: bindApiCall<ConversationsListArguments, WebAPICallResult>(this, 'conversations.list'),
    mark: bindApiCall<ConversationsMarkArguments, WebAPICallResult>(this, 'conversations.mark'),
    members: bindApiCall<ConversationsMembersArguments, WebAPICallResult>(this, 'conversations.members'),
    open: bindApiCall<ConversationsOpenArguments, WebAPICallResult>(this, 'conversations.open'),
    rename: bindApiCall<ConversationsRenameArguments, WebAPICallResult>(this, 'conversations.rename'),
    replies: bindApiCall<ConversationsRepliesArguments, WebAPICallResult>(this, 'conversations.replies'),
    setPurpose: bindApiCall<ConversationsSetPurposeArguments, WebAPICallResult>(this, 'conversations.setPurpose'),
    setTopic: bindApiCall<ConversationsSetTopicArguments, WebAPICallResult>(this, 'conversations.setTopic'),
    unarchive: bindApiCall<ConversationsUnarchiveArguments, WebAPICallResult>(this, 'conversations.unarchive'),
  };

  public readonly views = {
    open: bindApiCall<ViewsOpenArguments, WebAPICallResult>(this, 'views.open'),
    publish: bindApiCall<ViewsPublishArguments, WebAPICallResult>(this, 'views.publish'),
    push: bindApiCall<ViewsPushArguments, WebAPICallResult>(this, 'views.push'),
    update: bindApiCall<ViewsUpdateArguments, WebAPICallResult>(this, 'views.update'),
  };

  public readonly dialog = {
    open: bindApiCall<DialogOpenArguments, WebAPICallResult>(this, 'dialog.open'),
  };

  public readonly dnd = {
    endDnd: bindApiCall<DndEndDndArguments, WebAPICallResult>(this, 'dnd.endDnd'),
    endSnooze: bindApiCall<DndEndSnoozeArguments, WebAPICallResult>(this, 'dnd.endSnooze'),
    info: bindApiCall<DndInfoArguments, WebAPICallResult>(this, 'dnd.info'),
    setSnooze: bindApiCall<DndSetSnoozeArguments, WebAPICallResult>(this, 'dnd.setSnooze'),
    teamInfo: bindApiCall<DndTeamInfoArguments, WebAPICallResult>(this, 'dnd.teamInfo'),
  };

  public readonly emoji = {
    list: bindApiCall<EmojiListArguments, WebAPICallResult>(this, 'emoji.list'),
  };

  public readonly files = {
    delete: bindApiCall<FilesDeleteArguments, WebAPICallResult>(this, 'files.delete'),
    info: bindApiCall<FilesInfoArguments, WebAPICallResult>(this, 'files.info'),
    list: bindApiCall<FilesListArguments, WebAPICallResult>(this, 'files.list'),
    revokePublicURL: bindApiCall<FilesRevokePublicURLArguments, WebAPICallResult>(this, 'files.revokePublicURL'),
    sharedPublicURL: bindApiCall<FilesSharedPublicURLArguments, WebAPICallResult>(this, 'files.sharedPublicURL'),
    upload: bindApiCall<FilesUploadArguments, WebAPICallResult>(this, 'files.upload'),
    comments: {
      delete: bindApiCall<FilesCommentsDeleteArguments, WebAPICallResult>(this, 'files.comments.delete'),
    },
    remote: {
      info: bindApiCall<FilesRemoteInfoArguments, WebAPICallResult>(this, 'files.remote.info'),
      list: bindApiCall<FilesRemoteListArguments, WebAPICallResult>(this, 'files.remote.list'),
      add: bindApiCall<FilesRemoteAddArguments, WebAPICallResult>(this, 'files.remote.add'),
      update: bindApiCall<FilesRemoteUpdateArguments, WebAPICallResult>(this, 'files.remote.update'),
      remove: bindApiCall<FilesRemoteRemoveArguments, WebAPICallResult>(this, 'files.remote.remove'),
      share: bindApiCall<FilesRemoteShareArguments, WebAPICallResult>(this, 'files.remote.share'),
    },
  };

  public readonly groups = {
    archive: bindApiCall<GroupsArchiveArguments, WebAPICallResult>(this, 'groups.archive'),
    create: bindApiCall<GroupsCreateArguments, WebAPICallResult>(this, 'groups.create'),
    createChild: bindApiCall<GroupsCreateChildArguments, WebAPICallResult>(this, 'groups.createChild'),
    history: bindApiCall<GroupsHistoryArguments, WebAPICallResult>(this, 'groups.history'),
    info: bindApiCall<GroupsInfoArguments, WebAPICallResult>(this, 'groups.info'),
    invite: bindApiCall<GroupsInviteArguments, WebAPICallResult>(this, 'groups.invite'),
    kick: bindApiCall<GroupsKickArguments, WebAPICallResult>(this, 'groups.kick'),
    leave: bindApiCall<GroupsLeaveArguments, WebAPICallResult>(this, 'groups.leave'),
    list: bindApiCall<GroupsListArguments, WebAPICallResult>(this, 'groups.list'),
    mark: bindApiCall<GroupsMarkArguments, WebAPICallResult>(this, 'groups.mark'),
    open: bindApiCall<GroupsOpenArguments, WebAPICallResult>(this, 'groups.open'),
    rename: bindApiCall<GroupsRenameArguments, WebAPICallResult>(this, 'groups.rename'),
    replies: bindApiCall<GroupsRepliesArguments, WebAPICallResult>(this, 'groups.replies'),
    setPurpose: bindApiCall<GroupsSetPurposeArguments, WebAPICallResult>(this, 'groups.setPurpose'),
    setTopic: bindApiCall<GroupsSetTopicArguments, WebAPICallResult>(this, 'groups.setTopic'),
    unarchive: bindApiCall<GroupsUnarchiveArguments, WebAPICallResult>(this, 'groups.unarchive'),
  };

  public readonly im = {
    close: bindApiCall<IMCloseArguments, WebAPICallResult>(this, 'im.close'),
    history: bindApiCall<IMHistoryArguments, WebAPICallResult>(this, 'im.history'),
    list: bindApiCall<IMListArguments, WebAPICallResult>(this, 'im.list'),
    mark: bindApiCall<IMMarkArguments, WebAPICallResult>(this, 'im.mark'),
    open: bindApiCall<IMOpenArguments, WebAPICallResult>(this, 'im.open'),
    replies: bindApiCall<IMRepliesArguments, WebAPICallResult>(this, 'im.replies'),
  };

  public readonly migration = {
    exchange: bindApiCall<MigrationExchangeArguments, WebAPICallResult>(this, 'migration.exchange'),
  };

  public readonly mpim = {
    close: bindApiCall<MPIMCloseArguments, WebAPICallResult>(this, 'mpim.close'),
    history: bindApiCall<MPIMHistoryArguments, WebAPICallResult>(this, 'mpim.history'),
    list: bindApiCall<MPIMListArguments, WebAPICallResult>(this, 'mpim.list'),
    mark: bindApiCall<MPIMMarkArguments, WebAPICallResult>(this, 'mpim.mark'),
    open: bindApiCall<MPIMOpenArguments, WebAPICallResult>(this, 'mpim.open'),
    replies: bindApiCall<MPIMRepliesArguments, WebAPICallResult>(this, 'mpim.replies'),
  };

  public readonly oauth = {
    access: bindApiCall<OAuthAccessArguments, WebAPICallResult>(this, 'oauth.access'),
    v2: {
      access: bindApiCall<OAuthV2AccessArguments, WebAPICallResult>(this, 'oauth.v2.access'),
    },
  };

  public readonly pins = {
    add: bindApiCall<PinsAddArguments, WebAPICallResult>(this, 'pins.add'),
    list: bindApiCall<PinsListArguments, WebAPICallResult>(this, 'pins.list'),
    remove: bindApiCall<PinsRemoveArguments, WebAPICallResult>(this, 'pins.remove'),
  };

  public readonly reactions = {
    add: bindApiCall<ReactionsAddArguments, WebAPICallResult>(this, 'reactions.add'),
    get: bindApiCall<ReactionsGetArguments, WebAPICallResult>(this, 'reactions.get'),
    list: bindApiCall<ReactionsListArguments, WebAPICallResult>(this, 'reactions.list'),
    remove: bindApiCall<ReactionsRemoveArguments, WebAPICallResult>(this, 'reactions.remove'),
  };

  public readonly reminders = {
    add: bindApiCall<RemindersAddArguments, WebAPICallResult>(this, 'reminders.add'),
    complete: bindApiCall<RemindersCompleteArguments, WebAPICallResult>(this, 'reminders.complete'),
    delete: bindApiCall<RemindersDeleteArguments, WebAPICallResult>(this, 'reminders.delete'),
    info: bindApiCall<RemindersInfoArguments, WebAPICallResult>(this, 'reminders.info'),
    list: bindApiCall<RemindersListArguments, WebAPICallResult>(this, 'reminders.list'),
  };

  public readonly rtm = {
    connect: bindApiCall<RTMConnectArguments, WebAPICallResult>(this, 'rtm.connect'),
    start: bindApiCall<RTMStartArguments, WebAPICallResult>(this, 'rtm.start'),
  };

  public readonly search = {
    all: bindApiCall<SearchAllArguments, WebAPICallResult>(this, 'search.all'),
    files: bindApiCall<SearchFilesArguments, WebAPICallResult>(this, 'search.files'),
    messages: bindApiCall<SearchMessagesArguments, WebAPICallResult>(this, 'search.messages'),
  };

  public readonly stars = {
    add: bindApiCall<StarsAddArguments, WebAPICallResult>(this, 'stars.add'),
    list: bindApiCall<StarsListArguments, WebAPICallResult>(this, 'stars.list'),
    remove: bindApiCall<StarsRemoveArguments, WebAPICallResult>(this, 'stars.remove'),
  };

  public readonly team = {
    accessLogs: bindApiCall<TeamAccessLogsArguments, WebAPICallResult>(this, 'team.accessLogs'),
    billableInfo: bindApiCall<TeamBillableInfoArguments, WebAPICallResult>(this, 'team.billableInfo'),
    info: bindApiCall<TeamInfoArguments, WebAPICallResult>(this, 'team.info'),
    integrationLogs: bindApiCall<TeamIntegrationLogsArguments, WebAPICallResult>(this, 'team.integrationLogs'),
    profile: {
      get: bindApiCall<TeamProfileGetArguments, WebAPICallResult>(this, 'team.profile.get'),
    },
  };

  public readonly usergroups = {
    create: bindApiCall<UsergroupsCreateArguments, WebAPICallResult>(this, 'usergroups.create'),
    disable: bindApiCall<UsergroupsDisableArguments, WebAPICallResult>(this, 'usergroups.disable'),
    enable: bindApiCall<UsergroupsEnableArguments, WebAPICallResult>(this, 'usergroups.enable'),
    list: bindApiCall<UsergroupsListArguments, WebAPICallResult>(this, 'usergroups.list'),
    update: bindApiCall<UsergroupsUpdateArguments, WebAPICallResult>(this, 'usergroups.update'),
    users: {
      list: bindApiCall<UsergroupsUsersListArguments, WebAPICallResult>(this, 'usergroups.users.list'),
      update: bindApiCall<UsergroupsUsersUpdateArguments, WebAPICallResult>(this, 'usergroups.users.update'),
    },
  };

  public readonly users = {
    conversations: bindApiCall<UsersConversationsArguments, WebAPICallResult>(this, 'users.conversations'),
    deletePhoto: bindApiCall<UsersDeletePhotoArguments, WebAPICallResult>(this, 'users.deletePhoto'),
    getPresence: bindApiCall<UsersGetPresenceArguments, WebAPICallResult>(this, 'users.getPresence'),
    identity: bindApiCall<UsersIdentityArguments, WebAPICallResult>(this, 'users.identity'),
    info: bindApiCall<UsersInfoArguments, WebAPICallResult>(this, 'users.info'),
    list: bindApiCall<UsersListArguments, WebAPICallResult>(this, 'users.list'),
    lookupByEmail: bindApiCall<UsersLookupByEmailArguments, WebAPICallResult>(this, 'users.lookupByEmail'),
    setPhoto: bindApiCall<UsersSetPhotoArguments, WebAPICallResult>(this, 'users.setPhoto'),
    setPresence: bindApiCall<UsersSetPresenceArguments, WebAPICallResult>(this, 'users.setPresence'),
    profile: {
      get: bindApiCall<UsersProfileGetArguments, WebAPICallResult>(this, 'users.profile.get'),
      set: bindApiCall<UsersProfileSetArguments, WebAPICallResult>(this, 'users.profile.set'),
    },
  };

  public readonly workflows = {
    stepCompleted: bindApiCall<WorkflowsStepCompletedArguments, WebAPICallResult>(this, 'workflows.stepCompleted'),
    stepFailed: bindApiCall<WorkflowsStepFailedArguments, WebAPICallResult>(this, 'workflows.stepFailed'),
    updateStep: bindApiCall<WorkflowsUpdateStepArguments, WebAPICallResult>(this, 'workflows.updateStep'),
  };
}

/**
 * Generic method definition
 */
export default interface Method<
  MethodArguments extends WebAPICallOptions,
  MethodResult extends WebAPICallResult = WebAPICallResult
> {
  (options?: MethodArguments): Promise<MethodResult>;
}

/*
 * Reusable "protocols" that some MethodArguments types can conform to
 */
export interface TokenOverridable {
  token?: string;
}

export interface LocaleAware {
  include_locale?: boolean;
}

export interface Searchable {
  query: string;
  highlight?: boolean;
  sort: 'score' | 'timestamp';
  sort_dir: 'asc' | 'desc';
}

// A set of method names is initialized here and added to each time an argument type extends the CursorPaginationEnabled
// interface, so that methods are checked against this set when using the pagination helper. If the method name is not
// found, a warning is emitted to guide the developer to using the method correctly.
export const cursorPaginationEnabledMethods: Set<string> = new Set();
export interface CursorPaginationEnabled {
  limit?: number; // natural integer, max of 1000
  cursor?: string; // find this in a response's `response_metadata.next_cursor`
}

export interface TimelinePaginationEnabled {
  oldest?: string;
  latest?: string;
  inclusive?: boolean;
}

export interface TraditionalPagingEnabled {
  page?: number; // default: 1
  count?: number; // default: 100
}

/*
 * MethodArguments types (no formal relationship other than the generic constraint in Method<>)
 */

/*
 * `admin.*`
 */
export interface AdminAppsApproveArguments extends WebAPICallOptions, TokenOverridable {
  app_id?: string;
  request_id?: string;
  team_id?: string;
}
export interface AdminAppsApprovedListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id?: string;
  enterprise_id?: string;
}
cursorPaginationEnabledMethods.add('admin.apps.approved.list');
export interface AdminAppsRequestsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id?: string;
}
cursorPaginationEnabledMethods.add('admin.apps.requests.list');
export interface AdminAppsRestrictArguments extends WebAPICallOptions, TokenOverridable {
  app_id?: string;
  request_id?: string;
  team_id?: string;
}
export interface AdminAppsRestrictedListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id?: string;
  enterprise_id?: string;
}
cursorPaginationEnabledMethods.add('admin.apps.restricted.list');

export interface AdminConversationsRestrictAccessAddGroupArguments extends WebAPICallOptions, TokenOverridable {
  channel_id: string;
  group_id: string;
  team_id?: string;
}

export interface AdminConversationsRestrictAccessListGroupsArguments extends WebAPICallOptions, TokenOverridable {
  channel_id: string;
  team_id?: string;
}

export interface AdminConversationsRestrictAccessRemoveGroupArguments extends WebAPICallOptions, TokenOverridable {
  channel_id: string;
  group_id: string;
  team_id: string;
}

export interface AdminConversationsSetTeamsArguments extends WebAPICallOptions, TokenOverridable {
  channel_id: string;
  team_id?: string;
  target_team_ids?: string[];
  org_channel?: boolean;
}
export interface AdminInviteRequestsApproveArguments extends WebAPICallOptions, TokenOverridable {
  invite_request_id: string;
  team_id: string;
}
export interface AdminInviteRequestsApprovedListArguments
  extends WebAPICallOptions,
    TokenOverridable,
    CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.inviteRequests.approved.list');
export interface AdminInviteRequestsDenyArguments extends WebAPICallOptions, TokenOverridable {
  invite_request_id: string;
  team_id: string;
}
export interface AdminInviteRequestsDeniedListArguments
  extends WebAPICallOptions,
    TokenOverridable,
    CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.inviteRequests.denied.list');
export interface AdminInviteRequestsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.inviteRequests.list');
export interface AdminTeamsAdminsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.teams.admins.list');
export interface AdminTeamsCreateArguments extends WebAPICallOptions, TokenOverridable {
  team_domain: string;
  team_name: string;
  team_description?: string;
  team_discoverability?: string;
}
export interface AdminTeamsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {}
cursorPaginationEnabledMethods.add('admin.teams.list');
export interface AdminTeamsOwnersListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.teams.owners.list');
export interface AdminTeamsSettingsInfoArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
}
export interface AdminTeamsSettingsSetDefaultChannelsArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  channel_ids: string[];
}
export interface AdminTeamsSettingsSetDescriptionArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  description: string;
}
export interface AdminTeamsSettingsSetDiscoverabilityArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  discoverability: 'open' | 'invite_only' | 'closed' | 'unlisted';
}
export interface AdminTeamsSettingseSetIconArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  image_url: string;
}
export interface AdminTeamsSettingsSetNameArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  name: string;
}
export interface AdminUsergroupsAddChannelsArguments extends WebAPICallOptions, TokenOverridable {
  usergroup_id: string;
  team_id?: string;
  channel_ids: string | string[];
}
export interface AdminUsergroupsAddTeamsArguments extends WebAPICallOptions, TokenOverridable {
  usergroup_id: string;
  team_ids: string | string[];
  auto_provision?: boolean;
}
export interface AdminUsergroupsListChannelsArguments extends WebAPICallOptions, TokenOverridable {
  usergroup_id: string;
  include_num_members?: boolean;
  team_id?: string;
}
export interface AdminUsergroupsRemoveChannelsArguments extends WebAPICallOptions, TokenOverridable {
  usergroup_id: string;
  channel_ids: string | string[];
}
export interface AdminUsersAssignArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
}
export interface AdminUsersInviteArguments extends WebAPICallOptions, TokenOverridable {
  channel_ids: string;
  email: string;
  team_id: string;
  custom_message?: string;
  guest_expiration_ts?: string;
  is_restricted?: boolean;
  is_ultra_restricted?: boolean;
  real_name?: string;
  resend?: boolean;
}
export interface AdminUsersListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  team_id: string;
}
cursorPaginationEnabledMethods.add('admin.users.list');
export interface AdminUsersRemoveArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
}
export interface AdminUsersSetAdminArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
}
export interface AdminUsersSetExpirationArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
  expiration_ts: number;
}
export interface AdminUsersSetOwnerArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
}
export interface AdminUsersSetRegularArguments extends WebAPICallOptions, TokenOverridable {
  team_id: string;
  user_id: string;
}
export interface AdminUsersSessionResetArguments extends WebAPICallOptions, TokenOverridable {
  user_id: string;
  mobile_only?: boolean;
  web_only?: boolean;
}

/*
 * `api.*`
 */
export interface APITestArguments extends WebAPICallOptions {}

/*
 * `auth.*`
 */
export interface AuthRevokeArguments extends WebAPICallOptions, TokenOverridable {
  test: boolean;
}
export interface AuthTestArguments extends WebAPICallOptions, TokenOverridable {}

/*
 * `bots.*`
 */
export interface BotsInfoArguments extends WebAPICallOptions, TokenOverridable {
  bot?: string;
}

/*
 * `calls.*`
 */
export interface CallsAddArguments extends WebAPICallOptions, TokenOverridable {
  external_unique_id: string;
  join_url: string;
  created_by?: string;
  date_start?: number;
  desktop_app_join_url?: string;
  external_display_id?: string;
  title?: string;
  users?: CallUser[];
}

export interface CallsEndArguments extends WebAPICallOptions, TokenOverridable {
  id: string;
  duration?: number;
}

export interface CallsInfoArguments extends WebAPICallOptions, TokenOverridable {
  id: string;
}

export interface CallsUpdateArguments extends WebAPICallOptions, TokenOverridable {
  id: string;
  join_url?: string;
  desktop_app_join_url?: string;
  title?: string;
}

export interface CallsParticipantsAddArguments extends WebAPICallOptions, TokenOverridable {
  id: string;
  users: CallUser[];
}

export interface CallsParticipantsRemoveArguments extends WebAPICallOptions, TokenOverridable {
  id: string;
  users: CallUser[];
}

/*
 * `channels.*`
 */
export interface ChannelsArchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}

export interface ChannelsCreateArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  validate?: boolean;
}
export interface ChannelsHistoryArguments extends WebAPICallOptions, TokenOverridable, TimelinePaginationEnabled {
  channel: string;
  count?: number;
  unreads?: boolean;
}
export interface ChannelsInfoArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  channel: string;
}
export interface ChannelsInviteArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  user: string;
}
export interface ChannelsJoinArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  validate?: boolean;
}
export interface ChannelsKickArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  user: string;
}
export interface ChannelsLeaveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface ChannelsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  exclude_archived?: boolean;
  exclude_members?: boolean;
}
cursorPaginationEnabledMethods.add('channels.list');
export interface ChannelsMarkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
}
export interface ChannelsRenameArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  name: string;
  validate?: boolean;
}
export interface ChannelsRepliesArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  thread_ts: string;
}
export interface ChannelsSetPurposeArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  purpose: string;
}
export interface ChannelsSetTopicArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  topic: string;
}
export interface ChannelsUnarchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}

/*
 * `chat.*`
 */
export interface ChatDeleteArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
  as_user?: boolean;
}
export interface ChatDeleteScheduledMessageArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  scheduled_message_id: string;
  as_user?: boolean;
}
export interface ChatGetPermalinkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  message_ts: string;
}
export interface ChatMeMessageArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  text: string;
}
export interface ChatPostEphemeralArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  text: string;
  user: string;
  as_user?: boolean;
  attachments?: MessageAttachment[];
  blocks?: (KnownBlock | Block)[];
  link_names?: boolean;
  parse?: 'full' | 'none';
}
export interface ChatPostMessageArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  text: string;
  as_user?: boolean;
  attachments?: MessageAttachment[];
  blocks?: (KnownBlock | Block)[];
  icon_emoji?: string; // if specified, as_user must be false
  icon_url?: string;
  link_names?: boolean;
  mrkdwn?: boolean;
  parse?: 'full' | 'none';
  reply_broadcast?: boolean; // if specified, thread_ts must be set
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
  username?: string; // if specified, as_user must be false
}
export interface ChatScheduleMessageArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  text: string;
  post_at: string;
  as_user?: boolean;
  attachments?: MessageAttachment[];
  blocks?: (KnownBlock | Block)[];
  link_names?: boolean;
  parse?: 'full' | 'none';
  reply_broadcast?: boolean; // if specified, thread_ts must be set
  thread_ts?: string;
  unfurl_links?: boolean;
  unfurl_media?: boolean;
}
export interface ChatScheduledMessagesListArguments
  extends WebAPICallOptions,
    TokenOverridable,
    CursorPaginationEnabled {
  channel: string;
  latest: number;
  oldest: number;
}
cursorPaginationEnabledMethods.add('chat.scheduledMessages.list');
export interface ChatUnfurlArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
  unfurls: LinkUnfurls;
  user_auth_message?: string;
  user_auth_required?: boolean;
  user_auth_url?: string;
}
export interface ChatUpdateArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  text: string;
  ts: string;
  as_user?: boolean;
  attachments?: MessageAttachment[];
  blocks?: (KnownBlock | Block)[];
  link_names?: boolean;
  parse?: 'full' | 'none';
}

/*
 * `conversations.*`
 */
export interface ConversationsArchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface ConversationsCloseArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface ConversationsCreateArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  is_private?: boolean;
}
export interface ConversationsHistoryArguments
  extends WebAPICallOptions,
    TokenOverridable,
    CursorPaginationEnabled,
    TimelinePaginationEnabled {
  channel: string;
}
cursorPaginationEnabledMethods.add('conversations.history');
export interface ConversationsInfoArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  channel: string;
}
export interface ConversationsInviteArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  users: string; // comma-separated list of users
}
export interface ConversationsJoinArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface ConversationsKickArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  user: string;
}
export interface ConversationsLeaveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface ConversationsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  exclude_archived?: boolean;
  types?: string; // comma-separated list of conversation types
}
cursorPaginationEnabledMethods.add('conversations.list');
export interface ConversationsMarkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
}
export interface ConversationsMembersArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  channel: string;
}
cursorPaginationEnabledMethods.add('conversations.members');
export interface ConversationsOpenArguments extends WebAPICallOptions, TokenOverridable {
  channel?: string;
  users?: string; // comma-separated list of users
  return_im?: boolean;
}
export interface ConversationsRenameArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  name: string;
}
export interface ConversationsRepliesArguments
  extends WebAPICallOptions,
    TokenOverridable,
    CursorPaginationEnabled,
    TimelinePaginationEnabled {
  channel: string;
  ts: string;
}
cursorPaginationEnabledMethods.add('conversations.replies');
export interface ConversationsSetPurposeArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  purpose: string;
}
export interface ConversationsSetTopicArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  topic: string;
}
export interface ConversationsUnarchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}

/*
 * `dialog.*`
 */
export interface DialogOpenArguments extends WebAPICallOptions, TokenOverridable {
  trigger_id: string;
  dialog: Dialog;
}

/*
 * `dnd.*`
 */
export interface DndEndDndArguments extends WebAPICallOptions, TokenOverridable {}
export interface DndEndSnoozeArguments extends WebAPICallOptions, TokenOverridable {}
export interface DndInfoArguments extends WebAPICallOptions, TokenOverridable {
  user: string;
}
export interface DndSetSnoozeArguments extends WebAPICallOptions, TokenOverridable {
  num_minutes: number;
}
export interface DndTeamInfoArguments extends WebAPICallOptions, TokenOverridable {
  users?: string; // comma-separated list of users
}

/*
 * `emoji.*`
 */
export interface EmojiListArguments extends WebAPICallOptions, TokenOverridable {}

/*
 * `files.*`
 */
export interface FilesDeleteArguments extends WebAPICallOptions, TokenOverridable {
  file: string; // file id
}
export interface FilesInfoArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  file: string; // file id
  count?: number;
  page?: number;
}
cursorPaginationEnabledMethods.add('files.info');
export interface FilesListArguments extends WebAPICallOptions, TokenOverridable, TraditionalPagingEnabled {
  channel?: string;
  user?: string;
  ts_from?: string;
  ts_to?: string;
  types?: string; // comma-separated list of file types
}
export interface FilesRevokePublicURLArguments extends WebAPICallOptions, TokenOverridable {
  file: string; // file id
}
export interface FilesSharedPublicURLArguments extends WebAPICallOptions, TokenOverridable {
  file: string; // file id
}
export interface FilesUploadArguments extends WebAPICallOptions, TokenOverridable {
  channels?: string; // comma-separated list of channels
  content?: string; // if absent, must provide `file`
  file?: Buffer | Stream; // if absent, must provide `content`
  filename?: string;
  filetype?: string;
  initial_comment?: string;
  title?: string;
  thread_ts?: string; // if specified, `channels` must be set
}
export interface FilesCommentsDeleteArguments extends WebAPICallOptions, TokenOverridable {
  file: string; // file id
  id: string; // comment id
}
// either file or external_id is required
export interface FilesRemoteInfoArguments extends WebAPICallOptions, TokenOverridable {
  // either one of the file or external_id arguments are required
  file?: string;
  external_id?: string;
}
export interface FilesRemoteListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  ts_from?: string;
  ts_to?: string;
  channel?: string;
}
cursorPaginationEnabledMethods.add('files.remote.list');
export interface FilesRemoteAddArguments extends WebAPICallOptions, TokenOverridable {
  title: string;
  external_url: string;
  external_id: string; // a unique identifier for the file in your system
  filetype: string; // possible values (except for 'auto'): https://api.slack.com/types/file#file_types
  preview_image?: Buffer | Stream;
  indexable_file_contents?: Buffer | Stream;
}
export interface FilesRemoteUpdateArguments extends WebAPICallOptions, TokenOverridable {
  title?: string;
  external_url?: string;
  filetype?: string; // possible values (except for 'auto'): https://api.slack.com/types/file#file_types
  preview_image?: Buffer | Stream;
  indexable_file_contents?: Buffer | Stream;

  // either one of the file or external_id arguments are required
  file?: string;
  external_id?: string;
}
export interface FilesRemoteRemoveArguments extends WebAPICallOptions, TokenOverridable {
  // either one of the file or external_id arguments are required
  file?: string;
  external_id?: string;
}
export interface FilesRemoteShareArguments extends WebAPICallOptions, TokenOverridable {
  channels: string; // comma-separated list of channel ids

  // either one of the file or external_id arguments are required
  file?: string;
  external_id?: string;
}

/*
 * `groups.*`
 */
export interface GroupsArchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface GroupsCreateArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  validate?: boolean;
}
export interface GroupsCreateChildArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface GroupsHistoryArguments extends WebAPICallOptions, TokenOverridable, TimelinePaginationEnabled {
  channel: string;
  unreads?: boolean;
  count?: number;
}
export interface GroupsInfoArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  channel: string;
}
export interface GroupsInviteArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  user: string;
}
export interface GroupsKickArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  user: string;
}
export interface GroupsLeaveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface GroupsListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  exclude_archived?: boolean;
  exclude_members?: boolean;
}
cursorPaginationEnabledMethods.add('groups.list');
export interface GroupsMarkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
}
export interface GroupsOpenArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface GroupsRenameArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  name: string;
  validate?: boolean;
}
export interface GroupsRepliesArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  thread_ts: boolean;
}
export interface GroupsSetPurposeArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  purpose: string;
}
export interface GroupsSetTopicArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  topic: string;
}
export interface GroupsUnarchiveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}

/*
 * `im.*`
 */
export interface IMCloseArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface IMHistoryArguments extends WebAPICallOptions, TokenOverridable, TimelinePaginationEnabled {
  channel: string;
  count?: number;
  unreads?: boolean;
}
export interface IMListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {}
cursorPaginationEnabledMethods.add('im.list');
export interface IMMarkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
}
export interface IMOpenArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  user: string;
  return_im?: boolean;
}
export interface IMRepliesArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  thread_ts?: string;
}

/*
 * `migration.*`
 */
export interface MigrationExchangeArguments extends WebAPICallOptions, TokenOverridable {
  users: string; // comma-separated list of users
  to_old?: boolean;
}

/*
 * `mpim.*`
 */
export interface MPIMCloseArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface MPIMHistoryArguments extends WebAPICallOptions, TokenOverridable, TimelinePaginationEnabled {
  channel: string;
  count?: number;
  unreads?: boolean;
}
export interface MPIMListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {}
cursorPaginationEnabledMethods.add('mpim.list');
export interface MPIMMarkArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  ts: string;
}
export interface MPIMOpenArguments extends WebAPICallOptions, TokenOverridable {
  users: string; // comma-separated list of users
}
export interface MPIMRepliesArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  thread_ts: string;
}

/*
 * `oauth.*`
 */
export interface OAuthAccessArguments extends WebAPICallOptions {
  client_id: string;
  client_secret: string;
  code: string;
  redirect_uri?: string;
  single_channel?: string;
}
export interface OAuthV2AccessArguments extends WebAPICallOptions {
  client_id: string;
  client_secret: string;
  code: string;
  redirect_uri?: string;
}
/*
 * `pins.*`
 */
export interface PinsAddArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  // must supply one of:
  file?: string; // file id
  file_comment?: string;
  timestamp?: string;
}
export interface PinsListArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
}
export interface PinsRemoveArguments extends WebAPICallOptions, TokenOverridable {
  channel: string;
  // must supply one of:
  file?: string; // file id
  file_comment?: string;
  timestamp?: string;
}

/*
 * `reactions.*`
 */
export interface ReactionsAddArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  // must supply one of:
  channel?: string; // paired with timestamp
  timestamp?: string; // paired with channel
  file?: string; // file id
  file_comment?: string;
}
export interface ReactionsGetArguments extends WebAPICallOptions, TokenOverridable {
  full?: boolean;
  // must supply one of:
  channel?: string; // paired with timestamp
  timestamp?: string; // paired with channel
  file?: string; // file id
  file_comment?: string;
}
export interface ReactionsListArguments
  extends WebAPICallOptions,
    TokenOverridable,
    TraditionalPagingEnabled,
    CursorPaginationEnabled {
  user?: string;
  full?: boolean;
}
cursorPaginationEnabledMethods.add('reactions.list');
export interface ReactionsRemoveArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  // must supply one of:
  channel?: string; // paired with timestamp
  timestamp?: string; // paired with channel
  file?: string; // file id
  file_comment?: string;
}

/*
 * `reminders.*`
 */
export interface RemindersAddArguments extends WebAPICallOptions, TokenOverridable {
  text: string;
  time: string | number;
  user?: string;
}
export interface RemindersCompleteArguments extends WebAPICallOptions, TokenOverridable {
  reminder: string;
}
export interface RemindersDeleteArguments extends WebAPICallOptions, TokenOverridable {
  reminder: string;
}
export interface RemindersInfoArguments extends WebAPICallOptions, TokenOverridable {
  reminder: string;
}
export interface RemindersListArguments extends WebAPICallOptions, TokenOverridable {}

/*
 * `rtm.*`
 */
export interface RTMConnectArguments extends WebAPICallOptions, TokenOverridable {
  batch_presence_aware?: boolean;
  presence_sub?: boolean;
}
export interface RTMStartArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  batch_presence_aware?: boolean;
  mpim_aware?: boolean;
  no_latest?: '0' | '1';
  no_unreads?: string;
  presence_sub?: boolean;
  simple_latest?: boolean;
}

/*
 * `search.*`
 */
export interface SearchAllArguments extends WebAPICallOptions, TokenOverridable, TraditionalPagingEnabled, Searchable {}
export interface SearchFilesArguments
  extends WebAPICallOptions,
    TokenOverridable,
    TraditionalPagingEnabled,
    Searchable {}
export interface SearchMessagesArguments
  extends WebAPICallOptions,
    TokenOverridable,
    TraditionalPagingEnabled,
    Searchable {}

/*
 * `stars.*`
 */
export interface StarsAddArguments extends WebAPICallOptions, TokenOverridable {
  // must supply one of:
  channel?: string; // paired with `timestamp`
  timestamp?: string; // paired with `channel`
  file?: string; // file id
  file_comment?: string;
}
export interface StarsListArguments
  extends WebAPICallOptions,
    TokenOverridable,
    TraditionalPagingEnabled,
    CursorPaginationEnabled {}
cursorPaginationEnabledMethods.add('stars.list');
export interface StarsRemoveArguments extends WebAPICallOptions, TokenOverridable {
  // must supply one of:
  channel?: string; // paired with `timestamp`
  timestamp?: string; // paired with `channel`
  file?: string; // file id
  file_comment?: string;
}

/*
 * `team.*`
 */
export interface TeamAccessLogsArguments extends WebAPICallOptions, TokenOverridable {
  before?: number;
  count?: number;
  page?: number;
}
export interface TeamBillableInfoArguments extends WebAPICallOptions, TokenOverridable {
  user?: string;
}
export interface TeamInfoArguments extends WebAPICallOptions, TokenOverridable {}
export interface TeamIntegrationLogsArguments extends WebAPICallOptions, TokenOverridable {
  app_id?: string;
  change_type?: string; // TODO: list types: 'x' | 'y' | 'z'
  count?: number;
  page?: number;
  service_id?: string;
  user?: string;
}
export interface TeamProfileGetArguments extends WebAPICallOptions, TokenOverridable {
  visibility?: 'all' | 'visible' | 'hidden';
}

/*
 * `usergroups.*`
 */
export interface UsergroupsCreateArguments extends WebAPICallOptions, TokenOverridable {
  name: string;
  channels?: string; // comma-separated list of channels
  description?: string;
  handle?: string;
  include_count?: boolean;
}
export interface UsergroupsDisableArguments extends WebAPICallOptions, TokenOverridable {
  usergroup: string;
  include_count?: boolean;
}
export interface UsergroupsEnableArguments extends WebAPICallOptions, TokenOverridable {
  usergroup: string;
  include_count?: boolean;
}
export interface UsergroupsListArguments extends WebAPICallOptions, TokenOverridable {
  include_count?: boolean;
  include_disabled?: boolean;
  include_users?: boolean;
}
export interface UsergroupsUpdateArguments extends WebAPICallOptions, TokenOverridable {
  usergroup: string;
  channels?: string; // comma-separated list of channels
  description?: string;
  handle?: string;
  include_count?: boolean;
  name?: string;
}
export interface UsergroupsUsersListArguments extends WebAPICallOptions, TokenOverridable {
  usergroup: string;
  include_disabled?: boolean;
}
export interface UsergroupsUsersUpdateArguments extends WebAPICallOptions, TokenOverridable {
  usergroup: string;
  users: string; // comma-separated list of users
  include_count?: boolean;
}

/*
 * `users.*`
 */
export interface UsersConversationsArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled {
  exclude_archived?: boolean;
  types?: string; // comma-separated list of conversation types
  user?: string;
}
cursorPaginationEnabledMethods.add('users.conversations');
export interface UsersDeletePhotoArguments extends WebAPICallOptions, TokenOverridable {}
export interface UsersGetPresenceArguments extends WebAPICallOptions, TokenOverridable {
  user: string;
}
export interface UsersIdentityArguments extends WebAPICallOptions, TokenOverridable {}
export interface UsersInfoArguments extends WebAPICallOptions, TokenOverridable, LocaleAware {
  user: string;
}
export interface UsersListArguments extends WebAPICallOptions, TokenOverridable, CursorPaginationEnabled, LocaleAware {
  presence?: boolean; // deprecated, defaults to false
}
cursorPaginationEnabledMethods.add('users.list');
export interface UsersLookupByEmailArguments extends WebAPICallOptions, TokenOverridable {
  email: string;
}
export interface UsersSetPhotoArguments extends WebAPICallOptions, TokenOverridable {
  image: Buffer | Stream;
  crop_w?: number;
  crop_x?: number;
  crop_y?: number;
}
export interface UsersSetPresenceArguments extends WebAPICallOptions, TokenOverridable {
  presence: 'auto' | 'away';
}
export interface UsersProfileGetArguments extends WebAPICallOptions, TokenOverridable {
  include_labels?: boolean;
  user?: string;
}
export interface UsersProfileSetArguments extends WebAPICallOptions, TokenOverridable {
  profile?: string; // url-encoded json
  user?: string;
  name?: string; // usable if `profile` is not passed
  value?: string; // usable if `profile` is not passed
}

export interface ViewsOpenArguments extends WebAPICallOptions, TokenOverridable {
  trigger_id: string;
  view: View;
}

export interface ViewsPushArguments extends WebAPICallOptions, TokenOverridable {
  trigger_id: string;
  view: View;
}

export interface ViewsPublishArguments extends WebAPICallOptions, TokenOverridable {
  user_id: string;
  view: View;
  hash?: string;
}

export interface ViewsUpdateArguments extends WebAPICallOptions, TokenOverridable {
  view_id: string;
  view: View;
  external_id?: string;
  hash?: string;
}

  /*
   * `workflows.*`
   */
export interface WorkflowsStepCompletedArguments extends WebAPICallOptions, TokenOverridable {
  workflow_step_execute_id: string;
  outputs?: object;
}

export interface WorkflowsStepFailedArguments extends WebAPICallOptions, TokenOverridable {
  workflow_step_execute_id: string;
  error: {
    message: string;
  };
}

export interface WorkflowsUpdateStepArguments extends WebAPICallOptions, TokenOverridable {
  workflow_step_edit_id: string;
  inputs?: object;
  outputs?: {
    type: string;
    name: string;
    label: string;
  }[];
}

export * from '@slack/types';
