# RUNE 0.9.1 recovery

RUNE 0.9.1 corrects SchemaTex runtime packaging and evidence while preserving 0.9.0 contracts.

Recovery order:

1. verify `RUNE-0.9.1.zip` and its internal manifest;
2. verify `services/rune/assets/vendor/schematex/SHA256SUMS`;
3. run the direct SchemaTex module test;
4. run the focused engine and real Chromium SchemaTex tests;
5. start the API without `RUNE_DISPATCH_PROVIDER` and confirm local dispatch plus SchemaTex availability;
6. generate the complete SchemaTex API evidence bundle;
7. validate PDF/A independently with veraPDF when the external validator is available.
