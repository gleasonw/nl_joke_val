/**
 * This file was auto-generated by openapi-typescript.
 * Do not make direct changes to the file.
 */


export interface paths {
  "/api/clip": {
    get: operations["get-api-clip"];
  };
  "/api/clip_counts": {
    get: operations["list-api-clip-counts"];
  };
  "/api/emote_average_performance": {
    get: operations["get-api-emote-average-performance"];
  };
  "/api/emote_density": {
    get: operations["get-api-emote-density"];
  };
  "/api/emotes": {
    get: operations["list-api-emotes"];
  };
  "/api/is_live": {
    get: operations["get-api-is-live"];
  };
  "/api/latest_emote_performance": {
    get: operations["get-api-latest-emote-performance"];
  };
  "/api/series": {
    get: operations["list-api-series"];
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
    DeletedAt: {
      /** Format: date-time */
      Time: string;
      Valid: boolean;
    };
    Emote: {
      /** Format: int64 */
      BttvId: number;
      ChannelId: string;
      Code: string;
      /** Format: date-time */
      CreatedAt: string;
      DeletedAt: components["schemas"]["DeletedAt"];
      /** Format: int64 */
      ID: number;
      /** Format: date-time */
      UpdatedAt: string;
    };
    EmoteDensity: {
      Code: string;
      /** Format: int64 */
      Count: number;
      /** Format: int64 */
      EmoteID: number;
      /** Format: double */
      Percent: number;
    };
    EmoteDensityInput: {
      /** Format: date-time */
      From: string;
      /**
       * Format: int64
       * @default 10
       */
      Limit: number;
      /**
       * @default 9 hours
       * @enum {string}
       */
      Span: "1 minute" | "30 minutes" | "1 hour" | "9 hours" | "custom";
    };
    EmoteDensityReport: {
      /**
       * Format: uri
       * @description A URL to the JSON Schema for this object.
       */
      $schema?: string;
      Emotes: components["schemas"]["EmoteDensity"][];
      Input: components["schemas"]["EmoteDensityInput"];
    };
    EmoteFullRow: {
      /** Format: double */
      Average: number;
      Code: string;
      /** Format: double */
      Count: number;
      /** Format: double */
      Difference: number;
      /** Format: int64 */
      EmoteID: number;
      /** Format: double */
      PercentDifference: number;
    };
    EmotePerformanceInput: {
      /** Format: date-time */
      Date: string;
      /**
       * @default day
       * @enum {string}
       */
      Grouping: "hour" | "day";
    };
    EmoteReport: {
      /**
       * Format: uri
       * @description A URL to the JSON Schema for this object.
       */
      $schema?: string;
      Emotes: components["schemas"]["EmoteFullRow"][];
      Input: components["schemas"]["EmotePerformanceInput"];
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
    LatestEmotePerformanceInput: {
      /**
       * @default hour
       * @enum {string}
       */
      Grouping: "hour" | "day";
    };
    LatestEmoteReport: {
      /**
       * Format: uri
       * @description A URL to the JSON Schema for this object.
       */
      $schema?: string;
      Emotes: components["schemas"]["EmoteFullRow"][];
      Input: components["schemas"]["LatestEmotePerformanceInput"];
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

  "get-api-clip": {
    parameters: {
      query?: {
        time?: string;
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
  "list-api-clip-counts": {
    parameters: {
      query?: {
        emote_id?: number;
        span?: "30 minutes" | "1 hour" | "9 hours" | "1 week" | "1 month" | "1 year";
        grouping?: "25 seconds" | "1 minute" | "5 minutes" | "15 minutes" | "1 hour" | "1 day";
        order?: "ASC" | "DESC";
        limit?: number;
        from?: string;
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
  "get-api-emote-average-performance": {
    parameters: {
      query?: {
        date?: string;
        grouping?: "hour" | "day";
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["EmoteReport"];
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
  "get-api-emote-density": {
    parameters: {
      query?: {
        span?: "1 minute" | "30 minutes" | "1 hour" | "9 hours" | "custom";
        limit?: number;
        from?: string;
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["EmoteDensityReport"];
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
  "list-api-emotes": {
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["Emote"][];
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
  "get-api-is-live": {
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
  "get-api-latest-emote-performance": {
    parameters: {
      query?: {
        grouping?: "hour" | "day";
      };
    };
    responses: {
      /** @description OK */
      200: {
        content: {
          "application/json": components["schemas"]["LatestEmoteReport"];
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
  "list-api-series": {
    parameters: {
      query?: {
        span?: "1 minute" | "30 minutes" | "1 hour" | "9 hours";
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
