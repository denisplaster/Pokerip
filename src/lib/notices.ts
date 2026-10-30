/** Progress notifications returned by mutations and shown as toasts on the client. */
export interface ProgressNotice {
  kind: "LEVEL_UP" | "ACHIEVEMENT" | "MISSION_COMPLETE" | "SET_COMPLETE";
  title: string;
  description: string;
  coins?: number;
  icon?: string;
  tier?: string;
}
