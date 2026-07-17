export { GammaClient } from "./gamma.client.js";
export type { GammaClientOptions } from "./gamma.client.js";

export { ClobClient } from "./clob.client.js";
export type { ClobClientOptions } from "./clob.client.js";

export { DataClient } from "./data.client.js";
export type { DataClientOptions } from "./data.client.js";

export { normalizeGammaMarket } from "./normalize.js";

export { UpstreamHttpError } from "./http.js";
export type { UpstreamErrorKind } from "./http.js";

export {
  gammaMarketSchema,
  gammaMarketsResponseSchema,
  gammaPublicSearchResponseSchema,
  gammaEventSchema,
  gammaEventsResponseSchema,
} from "./schemas/gamma.schema.js";
export type { GammaMarket, GammaPublicSearchResponse, GammaEvent } from "./schemas/gamma.schema.js";

export { clobBookSchema, clobMidpointSchema, clobPriceHistorySchema } from "./schemas/clob.schema.js";
export type { ClobBook, ClobPriceHistory } from "./schemas/clob.schema.js";

export { openInterestSchema, holdersResponseSchema, tradesResponseSchema } from "./schemas/data.schema.js";
export type { OpenInterestResponse, HoldersResponse, TradesResponse } from "./schemas/data.schema.js";
