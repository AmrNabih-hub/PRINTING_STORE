# 📘 MASTER ENGINEERING REFERENCE DOCUMENT (MERD)
**Project Title:** Premium Centralized Print-On-Demand (POD) & Curated Interactive Gallery.
**System Paradigm:** Raw Headless Next.js Monorepo & Native Self-Hosted PostgreSQL Engine.
**Target Deployment Environment:** Node.js Edge Ecosystem + Custom WebSocket Streaming Bridge.
**Primary Audiences & Localization:** High-End E-commerce Customers & Delivery Workshops in Egypt (English & Localized Egyptian Arabic).

---

## 1. 🌍 EXECUTIVE SUMMARY & PHILOSOPHY
We are developing a high-investment, enterprise-grade Print-On-Demand pipeline seamlessly merged with a dynamic creator community gallery. It heavily prioritizes an Apple Vision-level spatial UI ("Premium Glass") and eliminates all generic frontend structures. It natively orchestrates operational routing to dynamic roles (Admin, Employee, Courier, Customer) without hard reloads via deep-socket PostgreSQL-to-React data pipelines. Machine Vision (AI) acts strictly as a mechanical auditor for print density, entirely decoupled from final server-calculated checkout algebra.

---

## 2. 🏛️ ARCHITECTURAL SYSTEM TOPOGRAPHY (NON-FUNCTIONAL DEMANDS)

To guarantee scaling without spaghetti code or structural regression, the system maps across strict dimensional layers:

### 2.1 The Repository Map (Strict Separation of Concerns)
*   **Decoupled State Engine (`@core/logic`):** The repository runs a headless stricture. Complex API request validation schemas (e.g., Zod inputs), algorithmic logic for dynamic checkout equations, system matrix parameters, and role-evaluation functions reside absolutely segregated from UI.
*   **The Client Canvas (`@apps/web`):** The frontend relies solely on reacting to State. No mathematical, operational, or database role-routing happens organically on the React DOM layer. The React frontend asks for data; it never computes secure endpoints.

### 2.2 Relational Strictness (The Postgres Rule)
*   **No ORM Speculation:** The foundational system is raw, custom-engineered PostgreSQL. Complex multi-table dependency policies (often pushed into brittle Row-Level-Security layers in generic tutorials) will NOT be implemented. Database rules reside via pure referential integrity—strict Foreign Keys, hardcoded Database Enums, and Immutable Views mapping data queries directly via isolated REST/Edge handlers.

### 2.3 Cultural Dialect Matrix (i18n Linguistics)
*   **Absolute Dynamic Text Hooks:** Static DOM string wrapping is forbidden. 100% of contextual application linguistics must dynamically query isolated master dictionary bundles per locale load state. 
*   **Vibrant Localization Constraints:** The standard UX English represents top-tier sophisticated enterprise software, whereas Arabic translation maps culturally directly into high-resonance Egyptian contextual "joyful" slang (e.g., phrases transitioning standard "Upload finished" logic functionally matching culturally nuanced outputs similar to "تمام يا باشا, هنظبط الألوان").
*   **Layout Morphism (RTL/LTR BIDI):** Design topologies enforce exclusively *Logical* CSS rules properties mapping `start` / `end` anchors. Physical alignments `Left/Right` exist purely in variable translation hooks so RTL shifting handles flawlessly upon dictionary flips.

---

## 3. 👥 MULTI-TIER PERSONA WORKFLOWS & RBAC DEMANDS

Access definitions traverse via injected, strictly validated JSON Web Token (JWT) secure header claims verified natively across internal Server Action pathways. Customers remain fundamentally blinded to internal route pathways.

### 3.1 Initial Identity (Invisible Onboarding Pipeline)
*   A user establishes base Auth. Next.js triggers *no* Role instructions context payload during auth initialization phase, neutralizing bad actors.
*   Upon DB authentication commitment natively running in Postgres context, a discrete Database Triggers automatically maps mapping the Auth UUID directly into local `profiles` enforcing immutable initialization restricted automatically as `customer`.

### 3.2 Tier Workloads 
*   **Role 1: Customer (Market-Side).** Bound purely to public routes (`/dashboard`, `/upload`, `/gallery`). Allowed read limits limited absolutely to `orders` associated to isolated auth `id`. Access limit denied from `/ops/` domain paths natively over Edge-routing intercept bounds.
*   **Role 2: Employee (Internal fulfillment & operations).** Displays auto-refreshed queues processing pending, physical completion parameters based around custom workload capacity routing scripts dynamically pushing database assignment bounds. (Cannot modify raw pricing structures, only order state).
*   **Role 3: Courier (Delivery execution layer).** Receives exact geo-data paths maps via Web-app UI payload context restricted mathematically upon employee final 'Handover' transition status updates mapping inside state machines tracking real-world physical delivery transitions over connected location-ping arrays. 
*   **Role 4: Admin (Full Override Sovereignty).** Granted UI metrics parameters overrides (Global Canvas prices limits/units, Role mappings manipulation layers inside master matrices dashboards.) Approvals on internal Customer public UI uploads mapping over Public Gallery index listings endpoints mapped securely under server scope checks.

---

## 4. 🔗 REACTIVE WEBSOCKET DYNAMIC PROTOCOLS (NO-POLL MECHANICS)

A paramount structural law: **No Manual Data Polling (`setInterval`) via API networks.**

*   **Native Real-Time Database Dispatching:** Because we host raw Postgres independent of a pre-managed backend engine, Real-time updates depend on low-level Custom Data pipelines invoking Native `NOTIFY / LISTEN` channels wrapping active event scopes inside table row insertions or internal UI logic data manipulation commands updating target row conditions (example role status shifts from 'Customer' tracking logic limits bounding into 'Employee').
*   **Dynamic UI Layout Restructure:** Websockets stream event data strictly into application Global State Context Maps bound on UI layout wrapping borders. When an Admin pushes "Role update" on the central Matrix Dash endpoint, Realtime pipeline connects Context logic directly—intercepting `dashboard` bounds mapping context routing updates directly over running layouts rendering immediate "Screen Transitions" forcing old layout drops transitioning gracefully using high priority physics bounding logic bringing the requested view up fluidly to targeted view spaces visually.

---

## 5. 💻 A.I VISUAL QUALITY ASSURANCE SYSTEM DEMANDS 

To eliminate systemic vulnerabilities surrounding financial manipulation mapping across dynamic order quotes and large processing requests—The architecture acts defensively limiting internal agent context capabilities strictly around image grading rather than checkout algebra variables limiters boundaries bounds.

### Data Flow Execution Law:
1.  **Ingestion/Compression Phase:** Upon UI user image upload request mapped by front end interaction mapping endpoints, Local edge node processor routes the stream logic passing over binary layers directly limiting raw pixels aggressively into a static low-profile rasterized matrix 512px thumb thumbnail. System logic inherently preserves High-Res master bounds strictly mapped securely via localized encrypted payload storage boundaries bounds isolated off node contexts maps strictly.
2.  **Machine Audit Gate Phase:** Lightweight Image is bridged into strict multi-modal external endpoint API endpoints executing JSON instructions limited natively passing exact requests context constraints looking mathematically identifying visual data constraints: determining physical ink density demand multiplier values / blur limits identifying printing non-violation readiness vectors constraints limits. 
3.  **Core Equation Calculation:** Return map JSON bounds data mapping internal variables over secure execution bounds checking Postgres live dynamic costs values checking variables securely. No Final cost numbers traverse into User-Browser endpoints maps before finalized verification mapping inside system limits strictly output natively through verified endpoint payloads ready strictly passing payload token limits bound into secure Checkout context loops (Egyptian payment hooks API wrappers).

---

## 6. 🎨 U.I. AND VISUAL TOPOGRAPHY (LIQUID UI SPECIFICATIONS)

Visual interaction mandates represent Top 1% tier global quality executing physical "object simulated" depth vectors wrapping structural UI nodes dynamically bound avoiding standard visual fatigue maps context layout. 

### 6.1 Ambient Liquid-Glass Matrices
*   **Bento Structure Definitions:** Standard UI cards function visually mimicking layered glass slabs utilizing immense context drop-shadowing parameters simulating internal light bleed logic wrapping border physics dynamically mimicking exact transparent/blur index variations mapping `x,y,z` variables natively inside css boundary arrays bounding `react-three-fiber` canvases.
*   **Hover Light Radiance Tracking:** Instead of basic button background modifications mapped across DOM interaction bounds mappings, the layout requires contextual JS Listeners analyzing continuous axis coordinate logic bounds dynamically appending visual color glow radii bounds mimicking flashlight ray beams pointing structurally underneath primary layered Glass cards shifting naturally per user physical physical hardware pointers motions limiting context rendering lags smoothly mappings. 

### 6.2 Topographical Element Disconnection
*   Global navigational components (Headings, Mobile Menus loops menus menus interfaces logic) MUST abandon viewport border hugging rendering constraints. All header interaction mapping limits floating structural 'pill' boundaries isolated cleanly utilizing identical deep layered blur properties structurally keeping DOM z-index arrays prioritized highest logic variables bounded. 

### 6.3 Spatial Mode Transitive Gradients 
We don’t render default colors natively bounded context standard maps bounds rendering limits constraints contexts limiting colors constraints. 
*   **Midnight Obsidian Engine (Dark State):** Heavily favors bottom level canvas blacks `#0B0C10` bound utilizing deep slate physical object cards bounds `#1F2833`. All highlights limit mapping via luminous pure Copper `#C5A880` metrics boundaries limits bound.
*   **Burnished Alabaster Matrix (Light State):** Refracts layout rendering `#F9F9F9` environments mapping bright `FFFFFF` visual variables bound boundaries rendering strict `B8860B` Burnished Golden interaction loops natively bounds context bounds natively bounded tracking context state machines logic limiting state machine bounds correctly mapping smoothly transition.

---

## 7. ⚖️ EXECUTION PATH RULES FOR AI GENERATION PIPELINE 
This Master Directive requires execution mapped strictly isolated logic chunks minimizing prompt pollution loops logic.

*   **PHASE 1 CORE: DATABASE & PERIMETER:** Build pure TS types. Output absolute schemas structure parameters mapped for native deployment mapping `ENums` strictly defining limits context boundaries securely. Do not create visual components map logic mappings securely. 
*   **PHASE 2 AUTHENTICATION BORDER:** Design purely isolated `Edge` variables intercept mapping bounds limits contexts contexts logic boundaries variables mapping variables boundaries routing limiting payloads context loop checks variables properly mappings logic routing correctly variables smoothly tracking context limits tracking loops checks variables maps variables routes checks context bounds variables limit routes accurately logic. 
*   **PHASE 3 SPATIAL/VISUAL WRAPPERS:** Create Base React context structures mapped tightly passing structural global spatial floating objects layouts and BIDI linguistic dictionaries mapped context logic mapping structure hooks bounds routing bounds securely bounded boundaries bounds hooks parameters maps mapping hooks accurately passing properly map boundary objects.
*   **PHASE 4 REAL TIME/ROUTING DASHBOARDS:** Configure custom Node Event stream passing native postgres state machines context loops tracking contexts dynamically passing UI context bounds replacing components via variables layout motion layout components layout structures motion loop rendering structures arrays.