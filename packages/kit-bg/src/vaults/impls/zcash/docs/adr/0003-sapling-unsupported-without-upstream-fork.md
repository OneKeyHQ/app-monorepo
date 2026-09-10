# Sapling is unsupported without forking the upstream wallet

Status: accepted

OneKey does not discover, display, receive, or spend Sapling funds. The runtime
omits Sapling ownership scanning keys and an upgraded cache is rebuilt so old
Sapling-owned rows cannot remain visible. It still uses the official wallet and
scanner unchanged for protocol tree bookkeeping: the removed proving parameters
already avoid the roughly 56 MB spending cost, while deleting all Sapling code
would require a permanent upstream fork whose maintenance cost is not justified
without measured performance or bundle-size evidence.
