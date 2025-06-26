export type SuccessResponse<T> = {
  data: T;
};

export type ErrorResponse = {
  data: undefined;
  errors: {
    status: number;
    title: string;
    details: Record<string, unknown>;
  }[];
};

export type Response<T> = SuccessResponse<T> | ErrorResponse;

export function isSuccessResponse<T>(
  response: Response<T>,
): asserts response is SuccessResponse<T> {
  if (response.data === undefined)
    throw new Error("data field missing from response");
}
