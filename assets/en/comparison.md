---
title: 12. Comparison of C++ formulas and WebSocket API
section: 12
---

# Comparison of C++ formulas and WebSocket API

You can extend the existing capabilities of the robot in two ways: using the [C++ formulas](c-api.md#cpp) mechanism and the [WebSocket API](api.md#api). These are different mechanisms that solve different tasks, yet they share some common features. For the convenience of users, the table below compares [C++ formulas](c-api.md#cpp) and [WebSocket API](api.md#api) across a number of parameters.

|Characteristic|[C++ formulas](c-api.md#cpp)|[WebSocket API](api.md#api)|
|---|---|---|
|Programming language|C++|Any programming language. Use a high-level language with standard libraries for working with the WebSocket protocol|
|Capabilities|Limited. There are restrictions on the length of the formula source code. You can get values for financial instruments and change some portfolio parameters. [User fields](params-description.md#p.user_fields) that are not used in the main algorithm are provided for use in formulas. Functions that access the file system or work with the network are forbidden. Time-consuming operations are highly undesirable. There is no way to get values from external data sources (databases, Excel tables, etc.)|Full. You can automate everything that is available through the platform's web interface. There are no restrictions on the application architecture or on the use of external data sources.
|Interaction between portfolios|Only between portfolios of the same robot, and the portfolios being accessed must have the [Shared formulas](params-description.md#p._sh_f) flag enabled|From one application you can interact with all available portfolios, regardless of which robots they belong to|
|Execution method|Native code, compiled into a dynamically loaded library that runs in the same thread as the robot's main algorithm code|A separate application that runs on another server|
|Impact on robot speed|Can slow down the robot because they are an integral part of the robot's main algorithm and run in the same thread|No impact on robot speed because the calculations run in parallel with the robot|
|Data access speed|Formula code runs whenever the main algorithm calls for price calculation. Accordingly, formulas are recalculated immediately after prices are received on any change in the order book. No restrictions are placed on access to data available in formulas|To get data or make changes, you must send a request; there are [limits](api.md#api.rate_limits) on the number of requests per unit time. When subscribing to data, the robot management server sends data not on every change, but in "batches" at a [certain frequency](api.md#api.updates_rate)|
|Fault tolerance|Errors in formulas can cause the entire robot to crash|A crash of a separate application affects only the calculations performed in that application; the robot continues to trade according to its algorithm and set parameters. Note that with this automation there is a risk of losing the connection between the robot and the separate application; in that case the robot continues to trade with the parameters it had before the connection was lost
