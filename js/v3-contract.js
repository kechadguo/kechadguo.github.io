/* R23 browser-side contract constants; writes remain owned by formal API handlers. */
window.V3_CONTRACT = Object.freeze({
  schemaVersion: 'v3-contract-1',
  occurredAtPrecision: Object.freeze(['EXACT', 'APPROXIMATE', 'RANGE', 'UNKNOWN']),
  inputMethod: Object.freeze(['FORM', 'QUICK', 'TIMER', 'VOICE', 'BACKFILL', 'MIGRATION', 'OFFLINE', 'SYSTEM']),
  completeness: Object.freeze(['COMPLETE', 'MISSED', 'UNCERTAIN', 'BACKFILLED', 'PENDING', 'UNKNOWN', 'TRUE_ZERO'])
});
