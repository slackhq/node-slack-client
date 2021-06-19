/*
 * Reusable shapes for argument values
 */

export enum DialogElementType {
  Text = 'text',
  TextArea = 'textarea',
  Select = 'select',
}

export enum DialogElementSubType {
  Email = 'email',
  Number = 'number',
  Telephone = 'tel',
  Url = 'url',
}

export enum DataSource {
  Users = 'users',
  Channels = 'channels',
  Conversations = 'conversations',
  External = 'external',
}

export interface Dialog {
  title: string;
  callback_id: string;
  elements: {
    type: DialogElementType;
    name: string; // shown to user
    label: string; // shown to user
    optional?: boolean;
    placeholder?: string;
    value?: string; // sent to app
    // types `text` & `textarea`:
    max_length?: number;
    min_length?: number;
    hint?: string;
    subtype?: DialogElementSubType;
    // type `select`:
    data_source?: DataSource;
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

export enum ViewType {
  Home = 'home',
  Modal = 'modal',
  WorkflowStep = 'workflow_step',
}

export interface View {
  title?: PlainTextElement;
  type: ViewType;
  blocks: AnyBlock[];
  callback_id?: string;
  close?: PlainTextElement;
  submit?: PlainTextElement;
  private_metadata?: string;
  clear_on_close?: boolean; // defaults to false
  notify_on_close?: boolean; // defaults to false
  submit_disabled?: boolean; // defaults to false
  external_id?: string;
}

/*
 * Block Elements
 */

export enum CompositionObjectType {
  PlainText = 'plain_text',
  Markdown = 'mrkdwn',
}

export enum ElementType {
  Image = 'image',
  UsersSelect = 'users_select',
  MultiUsersSelect = 'multi_users_select',
  StaticSelect = 'static_select',
  MultiStaticSelect = 'multi_static_select',
  ConversationsSelect = 'conversations_select',
  MultiConversationsSelect = 'multi_conversations_select',
  ChannelsSelect = 'channels_select',
  MultiChannelsSelect = 'multi_channels_select',
  ExternalSelect = 'external_select',
  MultiExternalSelect = 'multi_external_select',
  Button = 'button',
  Overflow = 'overflow',
  Datepicker = 'datepicker',
  Timepicker = 'timepicker',
  RadioButtons = 'radio_buttons',
  Checkboxes = 'checkboxes',
  PlainTextInput = 'plain_text_input',
}

export enum Style {
  Primary = 'primary',
  Danger = 'danger',
}

export interface ImageElement {
  type: ElementType.Image;
  image_url: string;
  alt_text: string;
}

export type AnyTextElement = PlainTextElement | MrkdwnElement;

export interface PlainTextElement {
  type: CompositionObjectType.PlainText;
  text: string;
  emoji?: boolean;
}

export interface MrkdwnElement {
  type: CompositionObjectType.Markdown;
  text: string;
  verbatim?: boolean;
}

export interface Option {
  text: AnyTextElement;
  value?: string;
  url?: string;
  description?: PlainTextElement;
}

export interface Confirm {
  title?: PlainTextElement;
  text: AnyTextElement;
  confirm?: PlainTextElement;
  deny?: PlainTextElement;
  style?: Style;
}

/*
 * Action Types
 */

// Selects and Multiselects are available in different surface areas so I've separated them here
export type Select =
  UsersSelect
  | StaticSelect
  | ConversationsSelect
  | ChannelsSelect
  | ExternalSelect;

export type MultiSelect =
  MultiUsersSelect
  | MultiStaticSelect
  | MultiConversationsSelect
  | MultiChannelsSelect
  | MultiExternalSelect;

export interface Action {
  type: string;
  action_id?: string;
}

export interface UsersSelect extends Action {
  type: ElementType.UsersSelect;
  initial_user?: string;
  placeholder?: PlainTextElement;
  confirm?: Confirm;
}

export interface MultiUsersSelect extends Action {
  type: ElementType.MultiUsersSelect;
  initial_users?: string[];
  placeholder?: PlainTextElement;
  max_selected_items?: number;
  confirm?: Confirm;
}

export interface StaticSelect extends Action {
  type: ElementType.StaticSelect;
  placeholder?: PlainTextElement;
  initial_option?: Option;
  options?: Option[];
  option_groups?: {
    label: PlainTextElement;
    options: Option[];
  }[];
  confirm?: Confirm;
}

export interface MultiStaticSelect extends Action {
  type: ElementType.MultiStaticSelect;
  placeholder?: PlainTextElement;
  initial_options?: Option[];
  options?: Option[];
  option_groups?: {
    label: PlainTextElement;
    options: Option[];
  }[];
  max_selected_items?: number;
  confirm?: Confirm;
}

export enum Filter {
  Im = 'im',
  Mpim = 'mpim',
  Private = 'private',
  Public = 'public',
}

export interface ConversationsSelect extends Action {
  type: ElementType.ConversationsSelect;
  initial_conversation?: string;
  placeholder?: PlainTextElement;
  confirm?: Confirm;
  response_url_enabled?: boolean;
  default_to_current_conversation?: boolean;
  filter?: {
    include?: Filter[];
    exclude_external_shared_channels?: boolean;
    exclude_bot_users?: boolean;
  };
}

export interface MultiConversationsSelect extends Action {
  type: ElementType.MultiConversationsSelect;
  initial_conversations?: string[];
  placeholder?: PlainTextElement;
  max_selected_items?: number;
  confirm?: Confirm;
  default_to_current_conversation?: boolean;
  filter?: {
    include?: Filter[];
    exclude_external_shared_channels?: boolean;
    exclude_bot_users?: boolean;
  };
}

export interface ChannelsSelect extends Action {
  type: ElementType.ChannelsSelect;
  initial_channel?: string;
  placeholder?: PlainTextElement;
  confirm?: Confirm;
}

export interface MultiChannelsSelect extends Action {
  type: ElementType.MultiChannelsSelect;
  initial_channels?: string[];
  placeholder?: PlainTextElement;
  max_selected_items?: number;
  confirm?: Confirm;
}

export interface ExternalSelect extends Action {
  type: ElementType.ExternalSelect;
  initial_option?: Option;
  placeholder?: PlainTextElement;
  min_query_length?: number;
  confirm?: Confirm;
}

export interface MultiExternalSelect extends Action {
  type: ElementType.MultiExternalSelect;
  initial_options?: Option[];
  placeholder?: PlainTextElement;
  min_query_length?: number;
  max_selected_items?: number;
  confirm?: Confirm;
}

export interface Button extends Action {
  type: ElementType.Button;
  text: PlainTextElement;
  value?: string;
  url?: string;
  style?: Style;
  confirm?: Confirm;
}

export interface Overflow extends Action {
  type: ElementType.Overflow;
  options: Option[];
  confirm?: Confirm;
}

export interface Datepicker extends Action {
  type: ElementType.Datepicker;
  initial_date?: string;
  placeholder?: PlainTextElement;
  confirm?: Confirm;
}

export interface Timepicker extends Action {
  type: ElementType.Timepicker;
  initial_time?: string;
  placeholder?: PlainTextElement;
  confirm?: Confirm;
}

export interface RadioButtons extends Action {
  type: ElementType.RadioButtons;
  initial_option?: Option;
  options: Option[];
  confirm?: Confirm;
}

export interface Checkboxes extends Action {
  type: ElementType.Checkboxes;
  initial_options?: Option[];
  options: Option[];
  confirm?: Confirm;
}

export interface PlainTextInput extends Action {
  type: ElementType.PlainTextInput;
  placeholder?: PlainTextElement;
  initial_value?: string;
  multiline?: boolean;
  min_length?: number;
  max_length?: number;
  dispatch_action_config?: DispatchActionConfig;
}

export enum DispatchActionOn {
  OnEnterPressed = 'on_enter_pressed',
  OnCharacterEntered = 'on_character_entered',
}

export interface DispatchActionConfig {
  trigger_actions_on?: DispatchActionOn[];
}

/*
 * Block Types
 */

export enum BlockType {
  Image = 'image',
  Context = 'context',
  Actions = 'actions',
  Divider = 'divider',
  Section = 'section',
  File = 'file',
  Header = 'header',
  Input = 'input',
}

export type KnownBlock =
  ImageBlock
  | ContextBlock
  | ActionsBlock
  | DividerBlock
  | SectionBlock
  | InputBlock
  | FileBlock
  | HeaderBlock;

export type AnyBlock = KnownBlock | Block;

export interface Block {
  type: string;
  block_id?: string;
}

export interface ImageBlock extends Block {
  type: BlockType.Image;
  image_url: string;
  alt_text: string;
  title?: PlainTextElement;
}

export type ContextableElement = ImageElement | AnyTextElement;

export interface ContextBlock extends Block {
  type: BlockType.Context;
  elements: ContextableElement[];
}

export type ActionsableElement = Button
  | Overflow
  | Datepicker
  | Timepicker
  | Select
  | RadioButtons
  | Checkboxes
  | Action;

export interface ActionsBlock extends Block {
  type: BlockType.Actions;
  elements: ActionsableElement[];
}

export interface DividerBlock extends Block {
  type: BlockType.Divider;
}

export type SectionableElement = Button
  | Overflow
  | Datepicker
  | Timepicker
  | Select
  | MultiSelect
  | Action
  | ImageElement
  | RadioButtons
  | Checkboxes;

/*
Using discriminated union type to better control the construct of a section block

SEE EXAMPLE BELOW
 */

export type SectionBlock = SectionBlockWithFields | SectionBlockWithText;

export interface SectionBlockBase extends Block {
  type: BlockType.Section;
  accessory?: SectionableElement;
}

export interface SectionBlockWithFields extends SectionBlockBase {
  fields: AnyTextElement[];
  text?: AnyTextElement;
}

export interface SectionBlockWithText extends SectionBlockBase {
  fields?: AnyTextElement[];
  text: AnyTextElement;
}


/*
const validSectionA: SectionBlock = {
  type: BlockType.Section,
  fields: [{
    type: CompositionObjectType.Markdown,
    text: 'hello',
  }],
};

const validSectionB: SectionBlock = {
  type: BlockType.Section,
  text: {
    type: CompositionObjectType.Markdown,
    text: 'hello',
  },
};

const invalidSection: SectionBlock = {
  type: BlockType.Section,
  accessory: {
    type: ElementType.Button,
    action_id: 'iAmInvalid',
    text: {
      type: CompositionObjectType.PlainText,
      text: `I don't work`,
    },
  },
};
 */

export interface FileBlock extends Block {
  type: BlockType.File;
  source: string; // 'remote'
  external_id: string;
}

export interface HeaderBlock extends Block {
  type: BlockType.Header;
  text: PlainTextElement;
}

export type InputableElement = Select
  | MultiSelect
  | Datepicker
  | Timepicker
  | PlainTextInput
  | RadioButtons
  | Checkboxes;

export interface InputBlock extends Block {
  type: BlockType.Input;
  label: PlainTextElement;
  hint?: PlainTextElement;
  optional?: boolean;
  element: InputableElement;
  dispatch_action?: boolean;
}

export enum AttachmentColor {
  Good = 'good',
  Warning = 'warning',
  Danger = 'danger',
}

export enum MrkdwnIn {
  Pretext = 'pretext',
  Text = 'text',
  Fields = 'fields',
}

export enum AttachmentStyle {
  Default = 'default',
}

export interface MessageAttachment {
  blocks?: AnyBlock[];
  fallback?: string; // either this or text must be defined
  color?: AttachmentColor | string;
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
  mrkdwn_in?: MrkdwnIn[];
}

export enum AttachmentActionType {
  Button = 'button',
  Select = 'select',
}

export interface AttachmentAction {
  id?: string;
  confirm?: Confirmation;
  data_source?: DataSource;
  min_query_length?: number;
  name?: string;
  options?: OptionField[];
  option_groups?: {
    text: string
    options: OptionField[];
  }[];
  selected_options?: OptionField[];
  style?: AttachmentStyle | Style;
  text: string;
  type: AttachmentActionType;
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

export type CallUser = CallUserSlack | CallUserExternal;

export interface CallUserSlack {
  slack_id: string;
}

export interface CallUserExternal {
  external_id: string;
  display_name: string;
  avatar_url: string;
}
