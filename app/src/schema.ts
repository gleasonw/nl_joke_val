/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */


export interface paths {
  "/api/clip": {
    /** Get nearest clip */
    get: operations["get-nearest-clip"];
  };
  "/api/clip_counts": {
    /** Get clip counts */
    get: operations["get-clip-counts"];
  };
  "/api/is_live": {
    /** Is NL live */
    get: operations["is-nl-live"];
  };
  "/api/series": {
    /** Get a time series of emote counts */
    get: operations["get-series"];
  };
}

export type webhooks = Record<string, never>;

export interface components {
  schemas: {
    Clip: {
      /**
       * Format: uri
       * @description A URL to the JSON Schema for this object.
       */
      $schema?: string;
      clip_id: string;
      /** Format: int64 */
      count: number;
      /** Format: date-time */
      time: string;
    };
    ErrorDetail: {
      /** @description Where the error occurred, e.g. 'body.items[3].tags' or 'path.thing-id' */
      location?: string;
      /** @description Error message text */
      message?: string;
      /** @description The value at the given location */
      value?: unknown;
    };
    ErrorModel: {
      /**
       * Format: uri
       * @description A URL to the JSON Schema for this object.
       */
      $schema?: string;
      /** @description A human-readable explanation specific to this occurrence of the problem. */
      detail?: string;
      /** @description Optional list of individual error details */
      errors?: components["schemas"]["ErrorDetail"][];
      /**
       * Format: uri
       * @description A URI reference that identifies the specific occurrence of the problem.
       */
      instance?: string;
      /**
       * Format: int64
       * @description HTTP status code
       */
      status?: number;
      /** @description A short, human-readable summary of the problem type. This value should not change between occurrences of the error. */
      title?: string;
      /**
       * Format: uri
       * @description A URI reference to human-readable documentation for the error.
       * @default about:blank
       */
      type?: string;
    };
    TimeSeries: {
      series: {
        [key: string]: number;
      };
      /** Format: date-time */
      time: string;
    };
  };
  responses: never;
  parameters: never;
  requestBodies: never;
  headers: never;
  pathItems: never;
}

export type $defs = Record<string, never>;

export type external = Record<string, never>;

export interface operations {

  /** Get nearest clip */
  "get-nearest-clip": {
    parameters: {
      query?: {
        time?: number;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["Clip"];
        };
      };
      /** @description Error */
      default: {
        content: {
          "application/problem+json": components["schemas"]["ErrorModel"];
        };
      };
    };
  };
  /** Get clip counts */
  "get-clip-counts": {
    parameters: {
      query?: {
        column?: string;
        span?: "30 minutes" | "9 hours" | "1 week" | "1 month" | "1 year";
        grouping?: "25 seconds" | "1 minute" | "5 minutes" | "15 minutes" | "1 hour" | "1 day";
        order?: "ASC" | "DESC";
        limit?: number;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["Clip"][];
        };
      };
      /** @description Error */
      default: {
        content: {
          "application/problem+json": components["schemas"]["ErrorModel"];
        };
      };
    };
  };
  /** Is NL live */
  "is-nl-live": {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": boolean;
        };
      };
      /** @description Error */
      default: {
        content: {
          "application/problem+json": components["schemas"]["ErrorModel"];
        };
      };
    };
  };
  /** Get a time series of emote counts */
  "get-series": {
    parameters: {
      query?: {
        span?: "1 minute" | "30 minutes" | "1 hour" | "9 hours" | "custom";
        grouping?: "second" | "minute" | "hour" | "day" | "week" | "month" | "year";
        rollingAverage?: number;
        from?: string;
        to?: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["TimeSeries"][];
        };
      };
      /** @description Error */
      default: {
        content: {
          "application/problem+json": components["schemas"]["ErrorModel"];
        };
      };
    };
  };
}
