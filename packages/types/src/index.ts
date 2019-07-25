
/*
 * Reusable shapes for argument values
 */
export interface Dialog {
  title: string;
  callback_id: string;
  elements: {
    type: 'text' | 'textarea' | 'select';
    name: string; // shown to user
    label: string; // shown to user
    optional?: boolean;
    placeholder?: string;
    value?: string; // sent to app
    // types `text` & `textarea`:
    max_length?: number;
    min_length?: number;
    hint?: string;
    subtype?: 'email' | 'number' | 'tel' | 'url';
    // type `select`:
    data_source?: 'users' | 'channels' | 'conversations' | 'external';
    selected_options?: SelectOption[];
    options?: SelectOption[];
    option_groups?: {
      label: string;
      options: SelectOption[];
    }[];
    min_query_length?: number;
  }[];
  submit_label?: string;
  notify_on_cancel?: boolean;
  state?: string;
}

/*
 * Block Elements
 */

/**
 * An element to insert an image - this element can be used in section and
 * context blocks only. If you want a block with only an image in it, you're
 * looking for the image block.
 *
 * https://api.slack.com/reference/messaging/block-elements#image
 */
export interface ImageElement {
  type: 'image';

  /**
   * The URL of the image to be displayed.
   */
  image_url: string;

  /**
   * A plain-text summary of the image. This should not contain any markup.
   */
  alt_text: string;
}

/*
 * Undocumented
 */
export interface UserElement {
  type: 'user';
  user_id: string;
}

/**
 * An object containing some text
 *
 * https://api.slack.com/reference/messaging/composition-objects#text
 */
export interface PlainTextElement {
  /**
   * The formatting to use for this text object
   */
  type: 'plain_text';

  /**
   * The text for the block
   */
  text: string;

  /**
   * Indicates whether emojis in a text field should be escaped into the
   * colon emoji format.
   */
  emoji?: boolean;
}

/**
 * An object containing some text
 *
 * https://api.slack.com/reference/messaging/composition-objects#text
 */
export interface MrkdwnElement {
  /**
   * The formatting to use for this text object
   */
  type: 'mrkdwn';

  /**
   * The text for the block. This field accepts any of the standard
   * [text formatting markup](https://api.slack.com/messaging/composing/formatting).
   */
  text: string;

  /**
   * When set to false (as is default) URLs will be auto-converted into links,
   * conversation names will be link-ified, and certain mentions will be
   * [automatically parsed](https://api.slack.com/messaging/composing/formatting#automatic-parsing).
   * Using a value of false will skip any preprocessing of this nature,
   * although you can still include
   * [manual parsing strings](https://api.slack.com/messaging/composing/formatting#advanced).
   */
  verbatim?: boolean;
}

/**
 * An object containing some text, formatted either as plain_text or using
 * [Slack's "mrkdwn"](https://api.slack.com/messaging/composing/formatting).
 *
 * https://api.slack.com/reference/messaging/composition-objects#text
 */
export type TextElement = MrkdwnElement | PlainTextElement;

/**
 * An object that represents a single selectable item in a select menu.
 *
 * https://api.slack.com/reference/messaging/composition-objects#option
 */
export interface Option {
  /**
   * 	A plain_text only text object that defines the text shown in the option
   * on the menu. Maximum length for the text in this field is 75 characters.
   */
  text: PlainTextElement;

  /**
   * The string value that will be passed to your app when this option is
   * chosen. Maximum length for this field is 75 characters.
   */
  value?: string;

  /*
   * Undocumented
   */
  url?: string;

  /*
   * Undocumented
   */
  description?: PlainTextElement;
}

/**
 * Provides a way to group options in a select menu.
 *
 * https://api.slack.com/reference/messaging/composition-objects#option-group
 */
export interface OptionGroup {
  /**
   * A plain_text only text object that defines the label shown above this
   * group of options. Maximum length for the text in this field is 75 characters.
   */
  label: PlainTextElement;

  /**
   * An array of option objects that belong to this specific group. Maximum of
   * 100 items.
   */
  options: Option[];
}

/**
 * An object that defines a dialog that provides a confirmation step to any
 * interactive element. This dialog will ask the user to confirm their action by
 * offering a confirm and deny buttons.
 *
 * https://api.slack.com/reference/messaging/composition-objects#confirm
 */
export interface Confirm {
  /**
   * A plain_text-only text object that defines the dialog's title. Maximum length
   * for this field is 100 characters.
   */
  title?: PlainTextElement;

  /**
   * A text object that defines the explanatory text that appears in the confirm
   * dialog. Maximum length for the text in this field is 300 characters.
   */
  text: TextElement;

  /**
   * A plain_text-only text object to define the text of the button that
   * confirms the action. Maximum length for the text in this field is 30
   * characters.
   */
  confirm?: PlainTextElement;

  /**
   * A plain_text-only text object to define the text of the button that
   * cancels the action. Maximum length for the text in this field is 30 characters.
   */
  deny?: PlainTextElement;
}

/*
 * Action Types
 */

 /**
  * All known action types, this is to differentiate from things
  * that have the form of an action but aren't known to slack.
  */
export type KnownAction =
  | UsersSelect
  | StaticSelect
  | ConversationsSelect
  | ChannelsSelect
  | ExternalSelect
  | Button
  | Overflow
  | Datepicker;

/**
 * Generic action type, you likely will not want to use this but
 * instead use one of the `KnownAction`s.
 */
export interface Action {
  type: string;

  /**
   * An identifier for the action triggered when a menu option is selected. You
   * can use this when you receive an interaction payload to
   * [identify the source of the action](https://api.slack.com/messaging/interactivity/enabling#understanding-payloads).
   * Should be unique among all other action_ids used elsewhere by your app.
   * Maximum length for this field is 255 characters.
   */
  action_id?: string;

  /**
   * A [confirm object](https://api.slack.com/reference/messaging/composition-objects#confirm)
   * that defines an optional confirmation dialog after the button is clicked.
   */
  confirm?: Confirm;
}

/**
 * This select menu will populate its options with a list of Slack users visible
 * to the current user in the active workspace.
 *
 * https://api.slack.com/reference/messaging/block-elements#users-select
 */
export interface UsersSelect extends Action {
  type: 'users_select';

  /**
   * The user ID of any valid user to be pre-selected when the menu loads.
   */
  initial_user?: string;

  /**
   * A plain_text only text object that defines the placeholder text shown on the
   * menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;
}

/**
 * This is the simplest form of select menu, with a static list of options passed
 * in when defining the element.
 *
 * https://api.slack.com/reference/messaging/block-elements#static-select
 */
export interface StaticSelect extends Action {
  type: 'static_select';

  /**
   * 	A plain_text only text object that defines the placeholder text shown on the
   * menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;

  /**
   * A single option that exactly matches one of the options within options or
   * option_groups. This option will be selected when the menu initially loads.
   */
  initial_option?: Option;

  /**
   * An array of option objects. Maximum number of options is 100. If option_groups
   * is specified, this field should not be.
   */
  options?: Option[];

  /**
   * An array of option group objects. Maximum number of option groups is 100.
   * If options is specified, this field should not be.
   */
  option_groups?: OptionGroup[];
}

/**
 * This select menu will populate its options with a list of public and private
 * channels, DMs, and MPIMs visible to the current user in the active workspace.
 *
 * https://api.slack.com/reference/messaging/block-elements#conversation-select
 */
export interface ConversationsSelect extends Action {
  type: 'conversations_select';

  /**
   * The ID of any valid conversation to be pre-selected when the menu loads.
   */
  initial_conversation?: string;

  /**
   * 	A plain_text only text object that defines the placeholder text shown on
   * the menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;
}

/**
 * This select menu will populate its options with a list of public channels
 * visible to the current user in the active workspace.
 *
 * https://api.slack.com/reference/messaging/block-elements#channel-select
 */
export interface ChannelsSelect extends Action {
  type: 'channels_select';

  /**
   * The ID of any valid public channel to be pre-selected when the menu loads.
   */
  initial_channel?: string;

  /**
   * 	A plain_text only text object that defines the placeholder text shown on
   * the menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;
}

/**
 * This select menu will load its options from an external data source,
 * allowing for a dynamic list of options.
 *
 * ## Setup
 * To use this menu type, you'll need to configure your app first:
 *
 * 1. Goto your app's settings page and choose the Interactive Components feature menu.
 * 2. Add a URL to the Options Load URL under Message Menus.
 * 3. Save changes.
 * Each time a select menu of this type is opened or the user starts typing in
 * the typeahead field, we'll send a request to your specified URL. Your app should
 * return an HTTP 200 OK response, along with an application/json post body with an object
 * containing either an options array, or an option_groups array. Here's an example response:
 *
 * https://api.slack.com/reference/messaging/block-elements#external-select
 */
export interface ExternalSelect extends Action {
  type: 'external_select';

  /**
   * A single option that exactly matches one of the options within the options
   * or option_groups loaded from the external data source. This option will be
   * selected when the menu initially loads.
   */
  initial_option?: Option;

  /**
   * A plain_text only text object that defines the placeholder text shown on the
   * menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;

  /**
   * When the typeahead field is used, a request will be sent on every character
   * change. If you prefer fewer requests or more fully ideated queries, use the
   * min_query_length attribute to tell Slack the fewest number of typed characters
   * required before dispatch.
   */
  min_query_length?: number;
}

/**
 * An interactive element that inserts a button. The button can be a trigger for
 * anything from opening a simple link to starting a complex workflow.
 *
 * To use interactive elements, you will need to make some changes to prepare your
 * app. Read our [guide to enabling interactivity](https://api.slack.com/messaging/interactivity/enabling).
 *
 * https://api.slack.com/reference/messaging/block-elements#button
 */
export interface Button extends Action {
  type: 'button';

  /**
   * A text object that defines the button's text. Can only be of type: plain_text.
   * Maximum length for the text in this field is 75 characters.
   */
  text: PlainTextElement;

  /**
   * The value to send along with the
   * [interaction payload](https://api.slack.com/messaging/interactivity/enabling#understanding-payloads).
   * Maximum length for this field is 75 characters.
   */
  value?: string;

  /**
   * The value to send along with the
   * [interaction payload](https://api.slack.com/messaging/interactivity/enabling#understanding-payloads).
   * Maximum length for this field is 75 characters.
   */
  url?: string;
  style?: 'danger' | 'primary';
}

/**
 * This is like a cross between a button and a select menu - when a user clicks
 * on this overflow button, they will be presented with a list of options to
 * choose from. Unlike the select menu, there is no typeahead field, and the
 * button always appears with an ellipsis ("…") rather than customisable text.
 *
 * As such, it is usually used if you want a more compact layout than a select
 * menu, or to supply a list of less visually important actions after a row of
 * buttons.
 *
 * To use interactive elements like this, you will need to make some changes
 * to prepare your app. Read our
 * [guide to enabling interactivity](https://api.slack.com/messaging/interactivity/enabling).
 *
 * https://api.slack.com/reference/messaging/block-elements#overflow
 */
export interface Overflow extends Action {
  type: 'overflow';

  /**
   * An array of option objects to display in the menu. Maximum number of options
   * is 5, minimum is 2.
   */
  options: Option[];

  /**
   * A plain_text only text object that defines the placeholder text shown on
   * the menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder: PlainTextElement;
}

/**
 * An element which lets users easily select a date from a calendar style UI.
 * Date picker elements can be used inside of section and actions blocks.
 *
 * To use interactive elements like this, you will need to make some changes
 * to prepare your app. Read our guide to enabling interactivity.
 *
 * https://api.slack.com/reference/messaging/block-elements#datepicker
 */
export interface Datepicker extends Action {
  type: 'datepicker';

  /**
   * The initial date that is selected when the element is loaded. This
   * should be in the format `YYYY-MM-DD`.
   */
  initial_date?: string;

  /**
   * A plain_text only text object that defines the placeholder text shown
   * on the menu. Maximum length for the text in this field is 150 characters.
   */
  placeholder?: PlainTextElement;
}

/*
 * Block Types
 */

/**
 * Block elements can be used inside of `section`, `context`, and `actions`
 * [layout blocks](https://api.slack.com/reference/messaging/blocks).
 *
 * Our guide to [composing rich message layouts](https://api.slack.com/messaging/composing/layouts)
 * shows you where and how to add blocks to messages.
 *
 * Finally, the [enabling interactivity guide](https://api.slack.com/messaging/interactivity/enabling)
 * will help you adjust your app to allow for the use of these interactive components.
 *
 * https://api.slack.com/reference/messaging/block-elements
 */
export type KnownBlock = ImageBlock | ContextBlock | ActionsBlock | DividerBlock | SectionBlock;

/**
 * Block elements can be used inside of `section`, `context`, and `actions`
 * [layout blocks](https://api.slack.com/reference/messaging/blocks).
 *
 * Our guide to [composing rich message layouts](https://api.slack.com/messaging/composing/layouts)
 * shows you where and how to add blocks to messages.
 *
 * Finally, the [enabling interactivity guide](https://api.slack.com/messaging/interactivity/enabling)
 * will help you adjust your app to allow for the use of these interactive components.
 *
 * https://api.slack.com/reference/messaging/block-elements
 */
export interface Block {
  type: string;

  /*
   * Undocumented
   */
  block_id?: string;
}

/**
 * An element to insert an image - this element can be used in section and context blocks only.
 * If you want a block with only an image in it, you're looking for the image block.
 *
 * https://api.slack.com/reference/messaging/block-elements#image
 */
export interface ImageBlock extends Block {
  type: 'image';

  /**
   * The URL of the image to be displayed.
   */
  image_url: string;

  /**
   * A plain-text summary of the image. This should not contain any markup.
   */
  alt_text: string;

  /*
   * Undocumented
   */
  title?: PlainTextElement;
}

/**
 * Displays message context, which can include both images and text.
 *
 * https://api.slack.com/reference/messaging/blocks#context
 */
export interface ContextBlock extends Block {
  type: 'context';

  /**
   * An array of [image elements](https://api.slack.com/reference/messaging/block-elements#image)
   * and [text objects](https://api.slack.com/reference/messaging/composition-objects#text).
   * Maximum number of items is 10.
   */
  elements: (ImageElement | UserElement | TextElement)[];
}

/**
 * A block that is used to hold interactive [elements](https://api.slack.com/reference/messaging/block-elements).
 *
 * https://api.slack.com/reference/messaging/blocks#actions
 */
export interface ActionsBlock extends Block {
  type: 'actions';

  /**
   * An array of interactive element objects - buttons, select menus, overflow
   * menus, or date pickers. There is a maximum of 5 elements in each action block.
   */
  elements: (KnownAction | Action)[];
}

/**
 * A content divider, to split up different blocks inside of a
 * message. The divider block is nice and neat, requiring only a type.
 *
 * https://api.slack.com/reference/messaging/blocks#divider
 */
export interface DividerBlock extends Block {
  type: 'divider';
}

/**
 * A section is one of the most flexible blocks available - it can be used as
 * a simple text block, in combination with text fields, or side-by-side with
 * any of the available [block elements](https://api.slack.com/reference/messaging/block-elements).
 *
 * https://api.slack.com/reference/messaging/blocks#section
 */
export interface SectionBlock extends Block {
  type: 'section';

  /**
   * The text for the block, in the form of a
   * [text object](https://api.slack.com/reference/messaging/composition-objects#text).
   * Maximum length for the text in this field is 3000 characters.
   */
  text?: TextElement; // either this or fields must be defined

  /**
   * An array of text objects. Any text objects included with fields will be
   * rendered in a compact format that allows for 2 columns of side-by-side
   * text. Maximum number of items is 10. Maximum length for the text in
   * each item is 2000 characters.
   */
  fields?: TextElement[]; // either this or text must be defined

  /**
   * One of the available [element objects](https://api.slack.com/reference/messaging/block-elements).
   */
  accessory?: KnownAction | Action | ImageElement;
}

export interface MessageAttachment {
  blocks?: (KnownBlock | Block)[];
  fallback?: string; // either this or text must be defined
  color?: 'good' | 'warning' | 'danger' | string;
  pretext?: string;
  author_name?: string;
  author_link?: string; // author_name must be present
  author_icon?: string; // author_name must be present
  title?: string;
  title_link?: string; // title must be present
  text?: string; // either this or fallback must be defined
  fields?: {
    title: string;
    value: string;
    short?: boolean;
  }[];
  image_url?: string;
  thumb_url?: string;
  footer?: string;
  footer_icon?: string; // footer must be present
  ts?: string;
  actions?: AttachmentAction[];
  callback_id?: string;
  mrkdwn_in?: ('pretext' | 'text' | 'fields')[];
}

export interface AttachmentAction {
  id?: string;
  confirm?: Confirmation;
  data_source?: 'static' | 'channels' | 'conversations' | 'users' | 'external';
  min_query_length?: number;
  name?: string;
  options?: OptionField[];
  option_groups?: {
    text: string
    options: OptionField[];
  }[];
  selected_options?: OptionField[];
  style?: 'default' | 'primary' | 'danger';
  text: string;
  type: 'button' | 'select';
  value?: string;
  url?: string;
}

export interface OptionField {
  description?: string;
  text: string;
  value: string;
}

export interface Confirmation {
  dismiss_text?: string;
  ok_text?: string;
  text: string;
  title?: string;
}

export interface LinkUnfurls {
  [linkUrl: string]: MessageAttachment;
}

export interface SelectOption {
  label: string; // shown to user
  value: string; // sent to app
}
