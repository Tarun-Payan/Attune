import { AppError } from "./AppError";

export class ValidationError extends AppError {
  constructor(
    message = "Please fix the highlighted fields",
    fields?: Record<string, string>,
  ) {
    super(400, message, "VALIDATION_ERROR", fields ? { fields } : undefined);
  }
}
