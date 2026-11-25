# RUNE 0.9.0 recovery

RUNE 0.9.0 extends the immutable 0.8.0 functional line.

Recovery order:

1. verify the external ZIP checksum and internal manifest;
2. restore with the exact .NET SDK and shared offline NuGet repository;
3. build and execute automated tests;
4. validate the local dispatcher default;
5. execute browser, NATS, veraPDF, AppTest, and supply-chain gates only when their exact external dependencies are available;
6. do not treat a blocked vulnerability database or missing AppTest dependency as a passing gate.
