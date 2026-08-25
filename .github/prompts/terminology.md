# Translation glossary

Terminology settled for this documentation. The translation workflow sends this
file with every request, so an edit here changes every translation made after it.

Anyone may edit this file. Add a row when a term was translated inconsistently,
or when a reviewer had to correct the same word twice. Keep one term per row and
keep the table sorted, so a change stays easy to read in a pull request. A term
that is only ever used in one document does not belong here.

## Terms

Translate the Russian term on the left as the English term on the right.

| Russian | English | Note |
| --- | --- | --- |
| алгоритм | algorithm | |
| биржа | exchange | |
| брокер | broker | |
| заявка | order | An instruction sent to the exchange. |
| инструмент | instrument | Or "financial instrument" where the prose needs it. |
| котировка | quote | |
| лог | log | |
| лот | lot | |
| нога | leg | As in the second leg of a paired trade. |
| объём | volume | |
| подключение | connection | |
| позиция | position | |
| портфель | portfolio | |
| приказ | order | The robot's internal command. Say "move order" for "приказ переместить заявку". |
| проскальзывание | slippage | |
| робот | robot | The English documents also say "bot" in places. Both are in use; follow the document you are editing until this is settled. |
| риск | risk | |
| сделка | trade | The completed transaction, as opposed to заявка. |
| спред | spread | |
| стакан | order book | "Market depth" is acceptable only where the source says "глубина рынка". |
| счёт | account | |
| таймер | timer | |
| торговля | trading | |
| формула | formula | The C++ formula mechanism. Plural "formulas". |
| шаг цены | price step | |

## Do not use

Wordings that turned out wrong in this documentation. The validator fails the
run when one appears in an English document, so add a row once you have
corrected a mistake, instead of correcting the same thing again later.

The table is deliberately empty. A rule belongs here only after a real
mistranslation was found and fixed, never on a hunch: a check that fires on
correct text is a check people learn to ignore.

| Wrong | Use instead |
| --- | --- |

## Deciding when a term is not listed

Prefer the wording already used in the English document you are editing. If the
document gives no precedent and this file does not either, keep the Russian term
verbatim rather than inventing an English one, and the reviewer will settle it.
