/**
 * @publicApi
 */
export interface QueueHubJob<T = any, R = any> {
  id: string;
  name: string;
  data: T;
  opts?: any;
  progress(value: number | object): Promise<void>;
  updateProgress(value: number | object): Promise<void>;
  update(data: T): Promise<void>;
  remove(): Promise<void>;
  retry(): Promise<void>;
  discard(): Promise<void>;
  moveToCompleted(returnValue: R, token?: string): Promise<any>;
  moveToFailed(error: Error, token?: string): Promise<void>;
  finished(): Promise<R>;
  waitUntilFinished(timeout?: number): Promise<R>;
  getState(): Promise<string>;
  toJSON(): any;
}
