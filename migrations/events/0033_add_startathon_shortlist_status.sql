-- Records the shortlisting outcome as team state.
--
-- Deliberately a separate column from startathon_teams.status rather than a
-- new value for it: four live queries read status = 'confirmed' (the SR call
-- pool in sr/claimCalls.ts and sr/listCallers.ts, the referral count in
-- getTeam.ts, and the application write gate in utils/startathonApplication.ts).
-- Overwriting status for the twenty shortlisted teams would silently drop them
-- out of all four. Payment eligibility is a second axis, so it gets a second
-- column.
--
-- NULL means the team submitted nothing or was not picked. The client sees
-- 'selected' only for 'shortlisted' -- waitlisted teams read as an ordinary
-- confirmed team until they are promoted, which is a one-row UPDATE here
-- rather than a redeploy.
--
-- The ids mirror STARTATHON_SHORTLISTED_TEAM_IDS / _WAITLISTED_ in
-- wrangler.jsonc, which the results email blast sends on. If those lists are
-- ever edited, this table is the other half of the edit.
ALTER TABLE startathon_teams ADD COLUMN shortlist_status TEXT
  CHECK (shortlist_status IN ('shortlisted', 'waitlisted'));

UPDATE startathon_teams SET shortlist_status = 'shortlisted' WHERE team_id IN (
  'ST_1784653435213_S4LUJB',
  'ST_1785126984908_JVTZLP',
  'ST_1785204014894_MNEU0M',
  'ST_1784473517764_DO7DSI',
  'ST_1784451551434_RHZ1IQ',
  'ST_1784478906474_WWNUK3',
  'ST_1785867078668_7XK7VN',
  'ST_1785688628576_P1KFOH',
  'ST_1784545565533_0OR9YK',
  'ST_1786004740467_79XOWU',
  'ST_1784457715724_7KBKFT',
  'ST_1785164983618_ENCANA',
  'ST_1785341114529_LFD6A2',
  'ST_1784638317569_QXQEWK',
  'ST_1785867651251_5X9QPB',
  'ST_1784730229425_AVNPNH',
  'ST_1785126911376_1GXZ38',
  'ST_1785903344869_BL0OIH',
  'ST_1784478677834_129EM9',
  'ST_1784448922398_M5FJ1L'
);

UPDATE startathon_teams SET shortlist_status = 'waitlisted' WHERE team_id IN (
  'ST_1784712839488_LMMKWS',
  'ST_1784556528828_CRLTB1',
  'ST_1785409438505_L2HWL0',
  'ST_1786544677610_3TQKHQ',
  'ST_1785477234080_TCEO1I',
  'ST_1786383955413_WTQ8OP',
  'ST_1785863609035_IQPHLA'
);

CREATE INDEX idx_startathon_teams_shortlist_status
  ON startathon_teams (shortlist_status);
