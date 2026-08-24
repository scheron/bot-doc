---
title: 12. Comparison of C++ Formulas and WebSocket API
section: 12
---

# Comparison of C++ Formulas and WebSocket API

Extending the existing capabilities of the robot is possible in two ways: using the [C++ formulas](c-api.md#cpp) mechanism and the [WebSocket API](api.md#api). These are different mechanisms that solve different tasks, nevertheless, these mechanisms have common features. For the convenience of users, the table below provides a comparison of [C++ formulas](c-api.md#cpp) and [WebSocket API](api.md#api) by a number of parameters.

|Characteristic|[C++ formulas](c-api.md#cpp)|[WebSocket API](api.md#api)|
|---|---|---|
|Programming language|C++|Any programming language. It is advisable to use high-level languages that have standard libraries for working with the WebSocket protocol|
|Capabilities|Limited. There are restrictions on the length of the source code of formulas. It is possible to obtain values for financial instruments and change some portfolio parameters. [User fields](params-description.md#p.user_fields) not used in the main algorithm are provided for use in formulas. The use of functions that access the file system or work with the network is prohibited. It is extremely undesirable to perform time-consuming operations. There is no way to obtain values from external data sources (databases, Excel tables, etc.)|Full. You can automate everything that is available through the platform's web interface. There are no restrictions on the application architecture or on the use of external data sources.
|Interaction between portfolios|Only possible between portfolios of one robot, and the portfolios being accessed must have the [Shared formulas](params-description.md#p._sh_f) flag set|You can interact from one application with all available portfolios regardless of which robots they belong to|
|Execution method|Native code compiled into a dynamically loaded library that runs in the same thread as the robot's main algorithm code|A separate application that runs on another server|
|Impact on robot speed|Can slow down the robot, as they are an integral part of the robot's main algorithm and run in the same thread with it|No impact on robot speed, since calculations are performed in parallel with the robot's operation|
|Data access speed|Formula code is always executed when the price calculation for the main algorithm is called. Accordingly, formulas are recalculated immediately after receiving prices on any change in the order book. No restrictions are imposed on access to data available in formulas|To obtain data or make changes, you need to send a corresponding request; there are [limits](api.md#api.rate_limits) on the number of requests sent per unit of time. When subscribing to data, data from the robot control server is not sent on every data change, but in "batches" with a [certain frequency](api.md#api.updates_rate)|
|Fault tolerance|Errors in formulas can cause the entire robot to crash|A crash of a separate application will only affect the calculations performed in that application, while the robot will continue to trade in accordance with its algorithm and specified parameters. It should be noted that with such automation there is a risk of communication failure between the robot and the separate application; in this case, the robot will continue to trade with the parameters it had before the communication failure
