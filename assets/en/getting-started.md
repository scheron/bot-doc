---
title: 4. Getting Started
section: 4
---

# Getting Started

The process of setting up a robot differs somewhat for live robots and robots available under the [role](introduction.md#roles) `Demo`. Demo robots have all necessary market-data connections configured, and changing the state of market-data connections (`Enabled`/`Disabled`) is prohibited. Creating trade connections is also prohibited, as such robots are not intended for live trading. When initially setting up such robots, skip the [Connection Setup](getting-started.md#connection_properties) chapter. In contrast, a live robot created for a client initially has no transactional connections and may lack active necessary market-data connections to exchanges. Therefore, first set up connections to receive market data and add transactional connections.

## Connection Setup <Anchor :ids="['connection_properties']" />

To activate market-data connections, select the `Data Connections` widget, check the necessary market-data connections, click the icon <img src="@images/icons/settings_black.svg" width="16" height="16"/> in the widget's top panel, select the robot for which the connection is activated, and choose `Enable`.

![Alt text](@images/3.1_1_2.jpg)

To configure trade connections, select the `Trade connections` widget, click the icon <img src="@images/icons/settings_black.svg" width="16" height="16"/> in the widget's top panel, select the robot for which the connection is added, and choose `Add`.

![Alt text](@images/3.1_2_2.jpg)

In the opened window, fill in the connection parameter fields. After filling all connection parameter fields, click `Add connection`.

In the `Status` column of the `Trade connections` and `Data connections` widgets, the statuses of the "data streams" of the respective connections to exchanges are displayed. If all statuses are green, the trade/market-data connection is connected to the exchange; otherwise, it is not connected.

**Important!**

If a trade connection is not connected to the exchange during trading hours for a sufficiently long interval, technical support informs the client. If 2 hours after the client has been informed the connection remains disconnected from the exchange, technical support reserves the right to change such a connection to an inactive state. This is because an incorrectly configured connection leads to undesirable and excessive activity on the exchange. In response to such actions, the exchange may block access for the client.

A trade connection that is in an inactive state can be edited. After changes are applied, the trade connection becomes active and all statuses should turn green.

## Hotkeys

Hotkeys are assigned to calls to the main widgets and operations in portfolios. Hotkey combinations are shown in widget menus and in the `Actions` menu. The full list of hotkeys is available in the user menu at the top right under Keyboad Shortcuts.

## Telegram Bot

The [FKVikingBot](https://t.me/FKVikingBot) telegram bot is used for telegram notifications. To connect the telegram bot, do the following:

- Add [FKVikingBot](https://t.me/FKVikingBot) to your telegram account by clicking the link and pressing the "START" button in the dialog with the telegram bot;
- Copy or write down the `TELEGRAM ID` sent by the telegram bot;
- Open the settings menu under the user icon and enter your `TELEGRAM ID` there.

![Doc](@images/telegram.png)

## Portfolio Setup <Anchor :ids="['portfolio_add']" />

To create a portfolio, select the `Portfolios table` widget and click `ADD`.

![Doc](@images/3.3_1_1.jpg)

In the opened window, in the drop-down list, select the robot in which the new portfolio will be created, in the `Portfolio name` field write the portfolio name (it is recommended to use meaningful names so that it is easier to navigate with a large number of portfolios; you cannot change the portfolio name later), and click `Submit`.

![Doc](@images/3.3_1_2.jpg)

To add exchange instruments, in the `AVAILABLE SECURITIES` section, in the `Exchange` drop-down list, select the exchange/market, and click `Reload security list from exchanges`. Then search for the exchange instrument by its `SecKey` in the same-name field. Once the desired instrument is found, click the icon <img src="@images/icons/plus.svg" width="16" height="16"/>.

![Doc](@images/3.3_1_3.jpg)

After this, the selected instrument appears in the `PORTFOLIO SECURITIES` section.

![Doc](@images/3.3_1_4.jpg)

Add the remaining instruments to the portfolio in the same way. After adding all instruments to the portfolio, click `Apply`. Then a window with portfolio settings opens. [Portfolio parameters](params-description.md#p) are set on the `Portfolio settings` tab, and [portfolio instrument parameters](params-description.md#portfolio-instrument-parameters) on the `Securities` tab. A detailed description of the parameters can be read by clicking the icon <img src="@images/icons/help.svg" width="16" height="16"/>. For portfolio instrument parameters, the icon <img src="@images/icons/help.svg" width="16" height="16"/> is in the drop-down list:

![Doc](@images/3.3_1_5.jpg)

A crossed-out instrument in the portfolio means that the expiration date of the financial instrument will occur in 3 days or less (excluding non-trading days). If the portfolio contains at least one such instrument, its name (`Name`) will also appear crossed out.

For real (not virtual) trading, in the [Client code](params-description.md#s.client_code) field, select the transactional connection created earlier instead of the value `virtual`.

For each portfolio, you can configure a trading on/off schedule by going to the [Timetable](params-description.md#p.use_tt) tab.

A guide with a detailed description of portfolio setup can be found at this [link](https://instructions.fkviking.com/portfolio_creation_guide.pdf).

## Portfolio Management <Anchor :ids="['portfolio_actions']" />

Portfolio management commands are in the drop-down menu of `ACTIONS` in the `Portfolios table` widget:

- **Start portfolios** <Anchor :ids="['portfolio_actions.start_portfolios']" /> – enables trading on the selected portfolios by setting the [re_sell](params-description.md#p.re_sell) and [re_buy](params-description.md#p.re_buy) flags. When setting up a trading schedule using the [Timetable](params-description.md#p.use_tt) parameter, enabling trading with the `Start portfolios` command does not work.

- **Stop portfolios** <Anchor :ids="['portfolio_actions.stop_portfolios']" /> - disables trading on the selected portfolios by clearing the [re_sell](params-description.md#p.re_sell) and [re_buy](params-description.md#p.re_buy) flags. Orders for the first leg are cancelled, orders for the second leg remain in the market and are moved according to the [SL](params-description.md#s.sl) and [Timer](params-description.md#s.timer) parameters. When setting up a trading schedule using the [Timetable](params-description.md#p.use_tt) parameter, disabling trading with the `Stop portfolios` command does not work.

- **Hard stop** <Anchor :ids="['portfolio_actions.hard_stop']" /> - stops trading on the selected portfolios (the [re_sell](params-description.md#p.re_sell) and [re_buy](params-description.md#p.re_buy) checkboxes are cleared), attempts to cancel placed orders on both legs, and disables the schedule (the `Use timetable` flag is cleared). This is a complete stop of trading on the selected portfolios, after which no orders will be placed or moved for any of the portfolio instruments.

    **Important!** If some portfolios have formulas that use programmatic control of the [re_sell](params-description.md#p.re_sell) and [re_buy](params-description.md#p.re_buy) flags, trading may continue in accordance with the configured formulas.

- **Stop formulas** <Anchor :ids="['portfolio_actions.stop_formulas']" /> - stops trading on the selected portfolios (the [re_sell](params-description.md#p.re_sell) and [re_buy](params-description.md#p.re_buy) checkboxes are cleared), attempts to cancel placed orders on both legs, and disables the schedule (the `Use timetable` flag is cleared). Also, all formula calculations are disabled, i.e., the portfolio flags [Custom trade](params-description.md#p.custom_trade) and [Extra formulas](params-description.md#p.ext_formulas) are cleared, and for each portfolio instrument, the [Count type](params-description.md#s.count_type) and [Ratio type](params-description.md#s.ratio_type) fields are set to the type corresponding to a constant value. To use formulas again, enable them yourself.

- **Reset statuses** <Anchor :ids="['portfolio_actions.reset_statuses']" /> - resets the internal statuses of all orders of all instruments of the selected portfolios. There are situations when, for some reason, the exchange does not send order information updates or sends them in a format that does not comply with the exchange documentation and is therefore not supported by the robot. For example, the robot placed an order, the order was placed, the robot sent a cancel request, the exchange cancelled the order but did not send information about the cancellation. In this case, the real status of the order on the exchange and the internal status of the order in the robot will differ, and since the robot waits for a response to its request, the order in the robot will hang in the "cancelling" status.
Use this button ONLY IN EXTREME CASES, when trading on the portfolio is disabled and you are sure there are no active orders for this portfolio; otherwise, the robot will lose active orders, which will lead to an incorrect position for financial instruments in the robot.

    **Important!** Note that unlike double-clicking the [Sell status](params-description.md#p.sell_status) and [Buy status](params-description.md#p.buy_status) fields in the `Portfolios table` widget table, this button resets the internal statuses of all orders of both legs of the portfolio.
    
    **Important!** After using this button, make sure there are no active orders on the exchange and that exchange positions match those in the robot.

- **To market** <Anchor :ids="['portfolio_actions.to_market']" /> - forcibly aligns positions of the selected portfolios. The behavior is exactly the same as using the [To market](params-description.md#p.to_market) clicker on the selected portfolios.

- **To0** <Anchor :ids="['portfolio_actions.to0']" /> - limits trading on the selected portfolios, allowing trading only in the direction of closing the position. The [To0](params-description.md#p.to0) flags are set for the selected portfolios.

- **Group TradingDays** <Anchor :ids="['portfolio_actions.trading_days']" /> - allows setting trading days for the selected portfolios. The behavior is similar to setting trading days in each portfolio's settings on the [Timetable](params-description.md#p.trading_days) tab, with the only difference being that only the changes made are applied to each portfolio. That is, if two portfolios had different lists of trading days: one had Monday, Tuesday, Friday, and the other had Monday, Tuesday, Friday, Saturday, Sunday, then if through this widget you add Thursday to both lists, the lists will not become equal.
    
    **Important!** This widget changes only the list of trading days; intervals defining trading time and the [Timetable](params-description.md#p.use_tt) checkbox itself will not be changed.

- **Group Timetable** <Anchor :ids="['portfolio_actions.timetable']" /> - allows setting trading intervals for the selected portfolios or copying trading intervals from an existing schedule of some portfolio. The behavior is similar to setting trading intervals in each portfolio's settings on the [Timetable](params-description.md#p.use_tt) tab, but additionally allows copying trading intervals from another portfolio.

    ![Doc](@images/group_timetable.gif)

- **Remove** <Anchor :ids="['portfolio_actions.remove_portfolio']" /> - deletes the selected portfolios.

  **Important!** When deleting a portfolio from the robot, related log records and trades are also deleted. Accordingly, they will also stop being displayed in widgets.

- **Clone portfolio** <Anchor :ids="['portfolio_actions.clone_portfolio']" /> - clones the selected portfolio in the same robot where the original cloned portfolio is located. To move portfolios between different robots, we recommend using [Export portfolio \ Import portfolio](portfolio_actions.disable_portfolio).

    **Important!** When cloning a portfolio, values that exist only as variables inside formula code, including indicators and their state, are not cloned.
    
- **Disable portfolio \ Enable portfolio** <Anchor :ids="['portfolio_actions.disable_portfolio', 'portfolio_actions.enable_portfolio']" /> - excludes the selected portfolios from calculations or returns the selected portfolios to normal operation by clearing and setting the [Disabled](params-description.md#p.disabled) flag. Do not confuse this feature with enabling and disabling trading on a portfolio. Using `Disable` allows you to exclude a currently unused portfolio from calculations. Prices will no longer come for all portfolio instruments and order books will not be built (only if the instruments are not used in other portfolios). Editing portfolio parameters in the `Disable` status is impossible. Be careful! Before switching a portfolio to `Disabled` mode, make sure trading on the portfolio is off, orders for portfolio instruments are not on the exchange and are not being placed at the moment, and also check that the portfolio's fields and its instruments are not used in formulas of other portfolios. Also, note that returning a portfolio from the `Disabled` state to the working state may lead to reopening the trading order book.

- **Export portfolio \ Import portfolio** <Anchor :ids="['portfolio_actions.export_portfolio', 'portfolio_actions.import_portfolio']" /> - exports the selected portfolios from the robot to the computer as a .ini file or imports portfolios into the robot.

  **Important!** The portfolio settings file, in addition to user-defined parameters, also contains exchange information about trading instruments. Therefore, when manually editing this file (via a text editor), any information not related to user-defined parameters must not be changed.

## Charts

Widgets are based on the TradingView chart. When clicking the icon <img src="@images/icons/chart-2.svg" width="16" height="16"/> in the `Chart` column of the [Portfolios table](interface.md#portfolios_table) widget, one of the widgets [Portfolios historical chart](interface.md#portfolios_historical_chart) or [Portfolios realtime chart](interface.md#Portfolios_realtime_chart) will open, depending on whether portfolio parameter history recording is enabled.

**RealTime mode for portfolios without parameter history recording**

The chart opens with preset portfolio parameter indicators [Sell](params-description.md#p.sell), [Buy](params-description.md#p.buy), [Lim_sell](params-description.md#p.lim_s), [Lim_buy](params-description.md#p.lim_b). You cannot change or add other indicators. The chart timeframe cannot be changed. Charts start drawing from the moment the widget opens. When the page is reloaded, chart data is not saved.

**Historical mode for portfolios with parameter history recording enabled**

The chart opens with preset portfolio parameter indicators [Sell](params-description.md#p.sell), [Buy](params-description.md#p.buy), [Lim_sell](params-description.md#p.lim_s), [Lim_buy](params-description.md#p.lim_b). These parameters can be removed or replaced. History recording is controlled by the user via the `Save history` parameter in the schedule on the [Timetable](params-description.md#p.use_tt) tab in the portfolio settings. The chart is shown for the displayed period, and historical data is loaded when scrolling right until the start of history recording. For MOEX markets, follow the market schedule to avoid uninformative gaps in history. There is a limit on the number of portfolios for which history saving is available. By default, the limit is 3 portfolios. For advice on increasing the limit, contact technical support. The chart can be viewed in different timeframes; change the timeframe at the top left. Selected indicators can be removed from the chart and other parameters available in the drop-down list of any user's portfolio can be added. Add instruments with the plus icon at the top left. The list can be viewed in the `Field` field.

![Doc](@images/3.5_1(1).jpg)

The main instrument is always present on the chart and cannot be removed; it can only be changed through the instrument addition menu on the `Main` tab. A significant part of TradingView's toolkit is available for the charts.
You can add several portfolios with history recording to one chart. The maximum chart history duration is 3 months. Then it begins to gradually fade, starting with the oldest data. Up to 10 chart widgets can be open simultaneously.

![Doc](@images/3.5_2.jpg)

The configured appearance is saved while the chart widget is open, as well as when reloading the page and switching Workspaces.
Note that the data for drawing the chart is a snapshot of online data on the parameters the robot trades. Data arrives on average 3 times per second, so if there were different values within 0.3 seconds, the last one will be displayed on the chart.

## Two-Factor Authentication <Anchor :ids="['two-factor-authentication']" />

To increase the security of user accounts, the platform implements a two-factor authentication (2FA) function. By default, 2FA is disabled.

**Enabling 2FA:**

***Installing the app:*** Install an authenticator app on your smartphone that supports the Time-based One-time Password (TOTP) protocol, such as Google Authenticator, Authy, or Microsoft Authenticator.

![Doc](@images/3.6_1.png)

***Platform setup:*** Log in to your account, go to the user menu, then to `Settings` and then to `Security`. Click `Enable 2FA`.

![Doc](@images/3.6_2.png)

***Scanning the QR code:*** Use the installed app to scan the QR code displayed on the screen and enter the confirmation code from the app.

![Doc](@images/3.6_3.png)

**Features of using 2FA:**

***Time on the device:*** Make sure the time on your device is synchronized with the exact time, as this is critical for the correct operation of TOTP.

***Device limit:*** In the `Security` section, you can view the list of confirmed devices. There can be no more than 20 such devices at the same time.

![Doc](@images/3.6_4.png)

***Disabling 2FA:*** To disable 2FA, click `Disable 2FA` in the `Security` section.

![Doc](@images/3.6_5.png)

**Additional information:**

***Code validity period:*** You have 120 seconds to enter the 2FA code; after this time, the connection will be closed.

***Confirmation frequency:*** You need to confirm 2FA every 14 days.

***Blocking on errors:*** If you enter an incorrect 2FA code 3 times in a row, input from this device will be blocked for 10 minutes.

***Code uniqueness:*** The same 2FA code cannot be used more than once in a row. If the code has already been used, wait for a new one to be generated for the next operation.

***Confirmation upon activation:*** When enabling 2FA, the secret key is valid for 10 minutes. If you do not confirm the setting during this time, you will need to repeat the process.

***Ending sessions:*** When activating 2FA, all active user sessions will be ended.

***Logout:*** To "forget" 2FA for this device, log out of your account.

***Access recovery:*** If you lose access to 2FA and cannot log in to your account, contact technical support. After identity verification, 2FA will be reset, and you can set it up again.

**It is recommended to set up two-factor authentication to increase the security of your account**

## IP Whitelist. <Anchor :ids="['ip_wl']" />

For greater security, you can restrict access to the platform from your login by specifying IP addresses from which access is allowed. It will be impossible to log in under your user from another IP address.

![Doc](@images/wl_ips.jpg)

The setting is in the user menu, then the `Settings` section, and then `Security`.

Define the list of IP addresses from which you need access, then enter them in the `Enter IP address` field and click `Add`.

When opening the menu, the IP address from which the connection is currently made will be detected and you will be offered to add it to the list immediately.

If the list is empty, access is allowed from any IP address. If the list contains at least 1 IP address, access is allowed only from it.

The list length is up to 10 IP addresses.

After adding all necessary IP addresses, save the changes via the `Apply Changes` button.

When applying the address list, all user connections not on the whitelist will be closed.
