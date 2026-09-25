# Roadmap notes

Internal planning notes (moved from a misnamed `README.me` at the repo root). These describe feature gaps that may still be open; they are not user-facing product documentation.

## Issue Description and Required Work

1. The repository currently includes two separate but related issues.
2. One issue concerns batch lock creation support.
3. Another issue concerns incomplete Arabic localization support.
4. The batch lock creation issue arises from a mismatch between feature request and implementation.
5. The request asked for a single transaction that creates multiple locks.
6. Note on multi-beneficiary split locks: Both `contracts/token-locker/src/lib.rs` and `contracts/lp-locker/src/lib.rs` already implement `create_split_lock`.
7. `create_split_lock` provides atomic multi-lock creation for a single token deposit split across 2–10 beneficiaries using basis-point shares, generating independent lock records in a single transaction.
8. What remains missing or distinct in the "batch creation" roadmap is a generalized `create_locks` (or arbitrary batch input) flow allowing heterogeneous parameters: multiple distinct tokens, independent release dates, and arbitrary per-lock configurations in one transaction, rather than identical token/date split configurations.
9. Without a generic `create_locks(Vec<LockInput>)` entry point for non-split heterogeneous locks, the app must send one transaction per distinct lock configuration.
10. Each individual transaction requires a separate wallet signature unless using `create_split_lock`.
11. This distinction should be kept clear: split-allocation batching is already shipped via `create_split_lock`, while arbitrary multi-token/multi-parameter batching remains a future consideration.
12. The frontend has a bulk operations feature, but it is not the same thing.
13. `BulkActionsToolbar` and `BulkConfirmModal` operate on existing locks.
14. They support bulk extending or bulk transferring existing lock records.
15. They do not support creating multiple arbitrary new locks in a single transaction.
16. The issue therefore only concerns arbitrary heterogeneous lock creation beyond split locks.
17. A proper arbitrary batch creation flow needs two pieces:
18. The first piece is contract-level support for batched lock creation (`create_locks(Vec<LockInput>)`).
19. The second piece is frontend UI to collect multiple lock definitions and submit them.
20. On the contract side, the code must validate each requested lock.
21. Validation should likely include amount, token, beneficiary, and unlock date.
22. It must also enforce the same rules as single-lock creation.
23. All locks in the batch should be created atomically.
24. If any one lock fails validation, the entire batch should revert.
25. This prevents partial success and inconsistent state.
26. A single entry point such as `create_locks(Vec<LockInput>)` is appropriate if multi-token batching is needed.
27. The contract would iterate over incoming lock definitions.
28. For each item, it would perform the same checks used by `create_lock`.
29. Then it would create the lock records in the same storage context.
30. This avoids multiple transactions and reduces user approvals for arbitrary multi-token configurations.
31. The batch entry point could also be useful for repeated single-token locking across varying unlock dates.
32. In the `lp-locker` contract, the same pattern applies.
33. Adding generalized batch creation there would mirror token-locker changes.
39. The frontend flow needs a "batch mode" on the create-lock form.
40. It needs to let users queue multiple lock definitions.
41. Each lock definition should include token, amount, beneficiary, unlock date.
42. There should be a clear UI for reviewing queued entries.
43. Users should be able to edit or remove entries before submission.
44. The UI could display a summary of batch size and estimated cost.
45. Once ready, the user submits a single batch transaction.
46. The app calls the new contract entry point with all queued entries.
47. This should be a single wallet signature flow.
48. The result is a much smoother experience for bulk locking.
49. It also avoids repeated confirmation popups.
50. In a broader sense, the batch create feature supports more complex workflows.
51. For example, projects onboarding many investors at once.
52. Or locking tokens across multiple beneficiaries in one operation.
53. The contract and UI should also preserve existing single-lock flows.
54. Existing `create_lock` should remain available for simple cases.
55. The new batch path should be additive, not disruptive.
56. That minimizes risk and migration pain.
57. The change should be documented in the UI and code comments.
58. The contract tests will need new coverage for batch creation.
59. They should cover success with multiple locks.
60. They should cover failure when one lock is invalid.
61. They should cover nested validation rules like zero amount or past date.
62. They should cover mixed token types if supported.
63. They should verify atomic rollback semantics.
64. If using Soroban or similar, the contract should use existing helper patterns.
65. The frontend should also add tests for batch mode.
66. This includes form state and queue management.
67. It also includes the final submission payload shape.
68. The API call should be asserted to use the batch endpoint.
69. If there is a transaction preview step, it should show the batch contents.
70. The frontend should gracefully handle contract errors from batch creation.
71. It should display clear messages if validation fails.
72. The app should avoid creating a partially applied batch.
73. That is the contract's job, but the UI must not misreport success.
74. There may also be wallet-specific limitations to consider.
75. Some wallets may impose transaction size caps.
76. The frontend should either warn on too-large batches or segment them.
77. That is a later enhancement if needed.
78. The immediate priority is supporting batch requests in principle.
79. The second issue is incomplete Arabic localization.
80. Internationalization support was added previously.
81. The language files appear in `src/i18n/locales`.
82. `en.json` is the reference locale with full coverage.
83. `es.json`, `zh.json`, `ko.json`, and `tr.json` are also fully populated.
84. But `ar.json` is not complete.
85. It contains only a small fraction of the expected keys.
86. The app likely falls back to English for missing Arabic strings.
87. That produces a broken or half-translated experience.
88. Users selecting Arabic would see a mix of Arabic and English.
89. This is worse than not offering Arabic at all.
90. The current language selector still includes Arabic.
91. That makes it appear as if Arabic support exists.
92. The right solution is to either complete Arabic or remove it until complete.
93. Completing Arabic would require translating every key in `en.json`.
94. That is a substantial localization effort.
95. It also requires maintaining coverage across namespaces.
96. A more practical fix is to hide Arabic until it is fully complete.
97. This prevents confusion and preserves trust in the UI.
98. The acceptance criteria are clear on this point.
99. Either `ar.json` has full coverage, or `ar` is removed from selection.
100. Additionally, a validation check is needed to prevent future drift.
101. Without a check, other locales may also drift silently.
102. The broad fix is to ensure all locale files share the same key set.
103. This includes the same namespaces and nested properties.
104. A good check can be a simple script or CI test.
105. The script should compare each non-English locale against `en.json`.
106. It should fail if any key is missing or extra.
107. That ensures every locale file maintains parity.
108. It should also be easy to run during development.
109. Ideally it is invoked by CI on pull requests.
110. This prevents regressions from merging incomplete translations.
111. A good implementation strategy is to centralize locale key extraction.
112. The script can read JSON files and recursively compare key trees.
113. It can ignore `en.json` itself, but validate every other locale.
114. It can produce a helpful diff when keys are missing.
115. That helps translators and reviewers quickly identify gaps.
116. The test should also work with newly added languages.
117. It should be generic, not hard-coded to known locales.
118. It should support nested namespaces by flattening keys.
119. It should verify that each locale file contains the same shape.
120. If a locale file has an extra key, that should also be reported.
121. This catches typos and stale translations as well.
122. The test can be part of the existing Vitest suite or a node script.
123. The repo already appears to use Vite and Vitest.
124. A `package.json` script like `test:i18n` would be appropriate.
125. It should run quickly and be deterministic.
126. It should use `fs` and `path` to load locale JSON files.
127. It can use a small helper for recursion, no heavy deps needed.
128. The output should be plain text and CI-friendly.
129. Example message: "Missing keys in ar.json: ...".
130. Another example: "Extra keys in es.json: ...".
131. The test should exit non-zero on failure.
132. This is the simplest way to enforce parity.
133. In addition, the language selector should be updated.
134. It should omit Arabic if `ar.json` is not complete.
135. That change is visible in `src/components/.../LanguageSelector.tsx`.
136. It may also require updating type definitions for supported locales.
137. The app should not expose the broken option anywhere else.
138. If there is a stored language preference, the fallback behavior should remain safe.
139. The app can still load Arabic if forced, but not advertise it.
140. That is a lower-risk approach than leaving it visible.
141. The contract issue and i18n issue are separate but both need attention.
142. The batch lock creation issue is a functional feature gap.
143. The Arabic locale issue is a quality and UX gap.
144. Both deserve their own fix commits and review.
145. The batch creation fix is likely larger and may touch core business logic.
146. The localization fix is smaller and isolates to frontend and tests.
147. However, both affect user trust and product quality.
148. The combined work can be described as improving scalability and polish.
149. The deliverables can be grouped as contract + UI + i18n.
150. Contract changes: add `create_locks` to both lockers, validate and create atomically.
151. Frontend changes: add a batch create mode, queue entries, submit one invocation.
152. i18n changes: remove incomplete Arabic support or finish translation, add locale key parity check.
153. The acceptance criteria should be testable and explicit.
154. For contracts: there must be a batch entry point and contract tests.
155. For frontend: there must be a visible batch creation flow with a single transaction.
156. For i18n: there must be no incomplete Arabic option or Arabic must be complete.
157. For CI: there must be a parity validation guard.
158. The issue statement mentions `src/i18n/locales/ar.json`.
159. It also mentions `LanguageSelector.tsx`.
160. Those files are the immediate frontend targets.
161. It is helpful to audit other locale-related code too.
162. The language selector may import a static list.
163. That list should be kept in sync with actual locale files.
164. A runtime-driven locale list is even safer.
165. For example, the app can scan `src/i18n/locales/*.json`.
166. But that is a larger change than needed.
167. A manual static list is acceptable if kept updated.
168. The test script helps ensure static lists remain correct.
169. If the app uses `useTranslation` or `i18next`, locale keys are likely nested.
170. The parity check must support nested JSON structures.
171. The check should not rely on translation values.
172. It should only compare keys and structure.
173. That makes it resilient to untranslated placeholder strings.
174. The check can also verify the number of namespaces.
175. The acceptance criteria mention `~19 namespaces`.
176. This means `en.json` likely contains multiple nested sections.
177. `ar.json` "only 2 of the ~19 namespaces" is a clear deficiency.
178. This is enough to justify removing Arabic if not complete.
179. The check can fail early if a locale has fewer namespaces.
180. That's a simple and effective regression guard.
181. It may also reveal other locales with drift.
182. Ensuring parity across all locales is best practice.
183. It avoids hidden fallback behavior.
184. It also aids translators in seeing what remains.
185. If the app currently falls back to English, that is silent failure.
186. Users may never realize translations are incomplete.
187. A stricter check makes the issue visible to developers.
188. It also stops new languages from being merged in half-supported form.
189. For the batch lock creation feature, integration testing is especially important.
190. If possible, add an example or story to the app documentation.
191. That helps reviewers understand the intended behavior.
192. It also helps QA test the feature more effectively.
193. The i18n parity test likewise serves as documentation of locale requirements.
194. Together, these changes improve developer confidence.
195. The final implementation should be reviewed in two parts.
196. One review should focus on contract correctness and atomicity.
197. The other review should focus on frontend UX and translation quality.
198. The issue can be closed only after both functional and UX conditions are satisfied.
199. In summary: add true batch lock creation and either complete or hide Arabic localization.
200. Also add an automated locale key parity check to prevent future drift.
