# Separate Zcash receive, output, and spend-pool policies

Status: accepted

OneKey models three independent policies instead of a single "latest pool":
the private Receive UA contains an Orchard receiver, new shielded outputs,
change, and Shield All currently land in Ironwood, and spendable shielded
sources are Orchard plus Ironwood. The App owns these explicit policy values
and passes them to the runtimes; runtimes validate them instead of silently
choosing defaults. This separation is required because Ironwood has no distinct
UA receiver typecode and a receive address therefore cannot identify the pool
where a post-NU6.3 payment will actually land.
