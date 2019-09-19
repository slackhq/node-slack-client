declare module "@aoberoi/capture-console" {
  export class CaptureConsole {
    public constructor();
    public startCapture(): void;
    public stopCapture(): void;
    getCapturedText(): string;
    clearCaptureText(): void;
  }
}
