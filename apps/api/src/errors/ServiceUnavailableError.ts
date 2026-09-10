import { AppError, type ErrorDetails } from "./AppError";

export class ServiceUnavailableError extends AppError {
  constructor(message = "Service Unavailable", details?: ErrorDetails) {
    super(503, message, "SERVICE_UNAVAILABLE", details);
  }
}
