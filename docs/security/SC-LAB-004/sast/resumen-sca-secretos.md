# Resumen SCA y secretos (SC-LAB-004)

## pnpm audit

Total dependencias: 1112. Vulnerabilidades: critical=3, high=18, moderate=22, low=2, info=0.

| Sev | Paquete | Vulnerable | Parcheado | Titulo | GHSA | Ruta (ejemplo) |
|---|---|---|---|---|---|---|
| critical | tinypool | <=2.1.0 | >=2.1.1 | Tinypool: Prototype Pollution gadget in worker options leads to Remote Code Execution | GHSA-5gmw-xhrv-c9v3 | apps__api>vitest>tinypool |
| critical | tinypool | <2.1.2 | >=2.1.2 | Tinypool: Prototype Pollution Gadget to RCE in run() options | GHSA-85c8-ppgw-ccpr | apps__api>vitest>tinypool |
| critical | vitest | <3.2.6 | >=3.2.6 | When Vitest UI server is listening, arbitrary file can be read and executed | GHSA-5xrq-8626-4rwp | apps__api>vitest |
| high | @cyclonedx/cyclonedx-npm | >=2.1.0 <5.0.0 | >=5.0.0 | @cyclonedx/cyclonedx-npm: Shell Injection via Unsanitized --workspace Argument | GHSA-v75r-vx73-82pj | .>@cyclonedx/cyclonedx-npm |
| high | @cyclonedx/cyclonedx-npm | <6.0.0 | >=6.0.0 | @cyclonedx/cyclonedx-npm: Shell Injection via Unsanitized --workspace Argument on Windows | GHSA-q69g-4hcv-6jg4 | .>@cyclonedx/cyclonedx-npm |
| high | braces | <=3.0.3 | <0.0.0 | braces vulnerable to stack-exhaustion denial of service through deeply nested patterns | GHSA-vfj7-8cjw-p6xm | apps__web>eslint-config-next>@next/eslint-plugin-next>fast-glob>micromatch>braces |
| high | deepmerge-ts | <8.0.0 | >=8.0.0 | DeepmergeTS has stack exhaustion when merging recursive object graphs | GHSA-ggr8-5vv4-36mx | apps__api>prisma>@prisma/config>deepmerge-ts |
| high | http-cache-semantics | <=4.2.0 | <0.0.0 | http-cache-semantics max-stale handling can disclose cross-user cached responses | GHSA-ch52-4w7c-c8xp | .>@cyclonedx/cyclonedx-npm>libxmljs2>node-gyp>make-fetch-happen>http-cache-semantics |
| high | multer | <2.3.0 | >=2.3.0 | multer vulnerable to Denial of Service via crafted multipart field names | GHSA-wc9g-mqfw-jrwm | apps__api>@nestjs/platform-express>multer |
| high | multer | =2.2.0 | >=2.3.0 | multer vulnerable to Denial of Service via file descriptor leak on aborted uploads | GHSA-qfvm-cv95-jqjf | apps__api>@nestjs/platform-express>multer |
| high | multer | <2.3.0 | >=2.3.0 | multer vulnerable to Denial of Service via oversized array index in field names | GHSA-535w-7cp7-47q4 | apps__api>@nestjs/platform-express>multer |
| high | nodemailer | >=3.0.0 <=7.0.10 | >=7.0.11 | Nodemailer’s addressparser is vulnerable to DoS caused by recursive calls | GHSA-rcmh-qjqh-p98v | apps__api>nodemailer |
| high | nodemailer | <=9.0.0 | >=9.0.1 | Nodemailer: Message-level raw option bypasses disableFileAccess/disableUrlAccess, enabling arbitrary file read and full-response SSRF in the delivered message | GHSA-p6gq-j5cr-w38f | apps__api>nodemailer |
| high | nodemailer | <9.1.0 | >=9.1.0 | Nodemailer: Quadratic (O(n²)) time complexity in addressparser allows remote denial of service via a crafted address list | GHSA-2x7j-588g-ccc2 | apps__api>nodemailer |
| high | nodemailer | <=10.0.5 | >=10.0.6 | Nodemailer: Quadratic backtracking in the addressparser free-text fallback allows remote denial of service | GHSA-v53p-9fqp-m79j | apps__api>nodemailer |
| high | nodemailer | <=8.0.7 | >=8.0.8 | Nodemailer: Improper TLS Certificate Validation in OAuth2 Token Fetch Enables Credential Interception | GHSA-r7g4-qg5f-qqm2 | apps__api>nodemailer |
| high | postcss | <=8.5.11 | >=8.5.12 | PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments | GHSA-6g55-p6wh-862q | apps__web>next>postcss |
| high | postcss | <=8.5.17 | >=8.5.18 | PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure | GHSA-r28c-9q8g-f849 | apps__web>next>postcss |
| high | sharp | <0.35.5 | >=0.35.5 | sharp : Vulnerability in librsvg dependency CVE-2026-96889 | GHSA-wq5f-xc86-pv6w | apps__web>next>sharp |
| high | source-map-js | >=1.0.0 <1.2.2 | >=1.2.2 | source-map-js allows event-loop denial of service through indexed source-map section offsets | GHSA-68fv-2mgg-jv7q | apps__web>postcss>source-map-js |
| high | vite | <=6.4.2 | >=6.4.3 | vite: `server.fs.deny` bypass on Windows alternate paths | GHSA-fx2h-pf6j-xcff | apps__api>unplugin-swc>unplugin>vite |
| moderate | @vitest/mocker | >=2.1.0 <4.1.11 | >=4.1.11 | Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock | GHSA-82fw-gwwq-j7x9 | apps__api>vitest>@vitest/mocker |
| moderate | esbuild | <=0.24.2 | >=0.25.0 | esbuild enables any website to send any requests to the development server and read the response | GHSA-67mh-4wv8-2f99 | apps__api>unplugin-swc>unplugin>vite>esbuild |
| moderate | file-type | >=13.0.0 <21.3.1 | >=21.3.1 | file-type affected by infinite loop in ASF parser on malformed input with zero-size sub-header | GHSA-5v7r-6r5c-r473 | apps__api>file-type |
| moderate | js-yaml | >=5.0.0 <=5.4.0 | >=5.4.1 | js-yaml: maxTotalMergeKeys does not limit CPU use for empty merge sources | GHSA-r3ph-w7gj-g6xm | apps__api>@nestjs/swagger>js-yaml |
| moderate | multer | >=2.2.0 <2.4.0 | >=2.4.0 | multer vulnerable to Denial of Service via orphaned disk writes on aborted uploads | GHSA-3pph-fpjx-jg34 | apps__api>@nestjs/platform-express>multer |
| moderate | next | >=15.0.0 <15.5.27 | >=15.5.27 | Next.js has cache poisoning of SSG and ISR pages in self-hosted applications | GHSA-4jqv-mc3x-m676 | apps__web>next |
| moderate | next | >=15.0.0 <15.5.27 | >=15.5.27 | Next.js has cache poisoning in SSG/ISR rendering that leads to cross-user content substitution and persistent denial of service | GHSA-mcj8-r9mp-w47p | apps__web>next |
| moderate | nodemailer | <7.0.7 | >=7.0.7 | Nodemailer: Email to an unintended domain can occur due to Interpretation Conflict | GHSA-mm7p-fcc7-pg87 | apps__api>nodemailer |
| moderate | nodemailer | <=8.0.4 | >=8.0.5 | Nodemailer Vulnerable to SMTP Command Injection via CRLF in Transport name Option (EHLO/HELO)  | GHSA-vvjj-xcjg-gr5g | apps__api>nodemailer |
| moderate | nodemailer | <=8.0.8 | >=8.0.9 | Nodemailer: CRLF injection in Nodemailer List-* header comments allows arbitrary message header injection | GHSA-268h-hp4c-crq3 | apps__api>nodemailer |
| moderate | nodemailer | <=8.0.8 | >=8.0.9 | Nodemailer jsonTransport bypasses disableFileAccess and disableUrlAccess during message normalization | GHSA-wqvq-jvpq-h66f | apps__api>nodemailer |
| moderate | nodemailer | <=9.1.0 | >=9.1.1 | Nodemailer: resolveContent() on a MailMessage bypasses disableFileAccess/disableUrlAccess when called with the legacy signature | GHSA-8m3c-c648-2xjj | apps__api>nodemailer |
| moderate | nodemailer | <9.1.0 | >=9.1.0 | Nodemailer: IDN/Punycode domain allow-list bypass leads to email delivery to an attacker-controlled domain | GHSA-wmmp-3585-3rmp | apps__api>nodemailer |
| moderate | nodemailer | >=6.9.16 <9.1.0 | >=9.1.0 | Nodemailer: Recipient-domain validation bypass via RFC 5322 comment mis-parsing leads to email delivery to an attacker-controlled domain | GHSA-cc9r-2j5m-2m83 | apps__api>nodemailer |
| moderate | nodemailer | >=5.0.0 <10.0.2 | >=10.0.2 | Nodemailer: Process-global DNS cache reuses TLS `servername` across transports, enabling cross-tenant SMTP credential disclosure | GHSA-6vj9-mwq6-2f5v | apps__api>nodemailer |
| moderate | nodemailer | <10.0.2 | >=10.0.2 | Nodemailer: Nested structured recipient arrays bypass the parser depth limit and cause stack exhaustion DoS | GHSA-8vvx-rff5-p5rq | apps__api>nodemailer |
| moderate | postcss | <8.5.10 | >=8.5.10 | PostCSS has XSS via Unescaped </style> in its CSS Stringify Output | GHSA-qx2v-qp2m-jg93 | apps__web>next>postcss |
| moderate | postcss | <=8.5.22 | >=8.5.23 | PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset | GHSA-fxqj-rqcc-2cmp | apps__web>next>postcss |
| moderate | postcss-selector-parser | <7.1.6 | >=7.1.6 | PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion | GHSA-rj75-hqrm-r3gf | apps__web>tailwindcss>postcss-selector-parser |
| moderate | vite | <=6.4.1 | >=6.4.2 | Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling | GHSA-4w7w-66w2-5vf9 | apps__api>unplugin-swc>unplugin>vite |
| moderate | vite | <=6.4.2 | >=6.4.3 | launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows | GHSA-v6wh-96g9-6wx3 | apps__api>unplugin-swc>unplugin>vite |
| moderate | vitest | >=2.1.0 <4.1.11 | >=4.1.11 | Vitest: Path Traversal / Arbitrary File Read via @vitest/mocker Redirect Mock | GHSA-82fw-gwwq-j7x9 | apps__api>vitest |
| low | multer | <2.3.0 | >=2.3.0 | multer vulnerable to file size limit bypass via async fileFilter race condition | GHSA-qvfw-j98x-7q72 | apps__api>@nestjs/platform-express>multer |
| low | nodemailer | <8.0.4 | >=8.0.4 | Nodemailer has SMTP command injection due to unsanitized `envelope.size` parameter | GHSA-c7w3-x93f-qmm8 | apps__api>nodemailer |

## gitleaks (historial git, --redact)

Hallazgos: 10 (14 commits escaneados).

| Regla | Archivo:linea | Commit | Secret |
|---|---|---|---|
| securecampus-url-postgres-con-credencial | scripts/setup.ps1:216 | f4722e7 | REDACTED |
| securecampus-url-postgres-con-credencial | scripts/setup.ps1:217 | f4722e7 | REDACTED |
| generic-api-key | scripts/setup.ps1:255 | f77d300 | REDACTED |
| securecampus-url-postgres-con-credencial | scripts/setup.ps1:216 | f77d300 | REDACTED |
| securecampus-url-postgres-con-credencial | scripts/setup.ps1:217 | f77d300 | REDACTED |
| securecampus-url-postgres-con-credencial | .github/workflows/ci.yml:73 | 46e3772 | REDACTED |
| securecampus-url-postgres-con-credencial | .github/workflows/ci.yml:74 | 46e3772 | REDACTED |
| securecampus-url-postgres-con-credencial | .github/workflows/ci.yml:81 | 46e3772 | REDACTED |
| securecampus-url-postgres-con-credencial | .github/workflows/ci.yml:82 | 46e3772 | REDACTED |
| securecampus-url-postgres-con-credencial | docker-compose.yml:120 | 46e3772 | REDACTED |
