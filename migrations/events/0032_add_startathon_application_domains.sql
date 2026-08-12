-- The problem domains a solution falls under (healthcare, fintech, …).
-- Free text rather than an enum: the domain list shifts between editions
-- and a wrong-shaped enum pushes teams into "other", which tells the
-- shortlisting panel nothing.
--
-- JSON array of strings, following prior_work: NULL means the team never
-- answered, '[]' means they explicitly declared none.
ALTER TABLE startathon_applications ADD COLUMN domains TEXT;
