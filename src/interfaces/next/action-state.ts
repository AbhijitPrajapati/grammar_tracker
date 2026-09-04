export type FieldErrors = Readonly<Record<string, readonly string[]>>;

// Includes the result of the action
export type ActionState<T = undefined> =
  | { readonly status: "idle" }
  | {
      readonly status: "error";
      readonly message: string;
      readonly fieldErrors?: FieldErrors;
    }
  | { readonly status: "success"; readonly data: T };

export const IDLE_ACTION_STATE: ActionState = { status: "idle" };
