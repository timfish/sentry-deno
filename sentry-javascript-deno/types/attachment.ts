// deno-lint-ignore-file 
export interface Attachment {
  data: string | Uint8Array;
  filename: string;
  contentType?: string;
  attachmentType?: string;
}
