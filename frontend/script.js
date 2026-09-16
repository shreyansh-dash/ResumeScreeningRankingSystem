console.log('🚀 Resume Screening Dashboard Loaded');

// ============================================================
// CONFIGURATION
// ============================================================

const API_BASE =
    window.location.port === '8000'
        ? ''
        : 'http://127.0.0.1:8000';

console.log(
    'API Base:',
    API_BASE || window.location.origin
);


// ============================================================
// UTILITIES
// ============================================================

const $ = (selector) =>
    document.querySelector(selector);


const escapeHTML = (text) => {

    if (
        text === null ||
        text === undefined
    ) {
        return '';
    }

    return String(text).replace(
        /[&<>"']/g,
        (match) => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        }[match])
    );
};


function getFilterValue(id) {

    const element =
        document.getElementById(id);

    return element
        ? element.value
        : '';
}


// ============================================================
// FILTER PARAMETER BUILDER
// ============================================================

function buildFilterParams(
    includePagination = true
) {

    const params =
        new URLSearchParams();


    if (includePagination) {

        params.set(
            'page',
            currentPage
        );

        params.set(
            'page_size',
            20
        );

        params.set(
            'sort',
            'AI_Score'
        );

        params.set(
            'direction',
            'desc'
        );
    }


    const role =
        getFilterValue('role');

    const decision =
        getFilterValue('decision');

    const certification =
        getFilterValue('certification');

    const search =
        getFilterValue('search').trim();

    const experience =
        getFilterValue('experience');

    const salaryFilter =
        getFilterValue('salaryFilter');

    const score =
        getFilterValue('score');


    // --------------------------------------------------------
    // Basic filters
    // --------------------------------------------------------

    if (role) {

        params.set(
            'role',
            role
        );
    }


    if (decision) {

        params.set(
            'decision',
            decision
        );
    }


    if (certification) {

        params.set(
            'certification',
            certification
        );
    }


    if (search) {

        params.set(
            'search',
            search
        );
    }


    // --------------------------------------------------------
    // Experience
    // --------------------------------------------------------

    if (experience) {

        const [min, max] =
            experience
                .split('-')
                .map(Number);


        if (!Number.isNaN(min)) {

            params.set(
                'min_experience',
                min
            );
        }


        if (!Number.isNaN(max)) {

            params.set(
                'max_experience',
                max
            );
        }
    }


    // --------------------------------------------------------
    // Salary
    // --------------------------------------------------------

    if (salaryFilter) {

        const [min, max] =
            salaryFilter
                .split('-')
                .map(Number);


        if (!Number.isNaN(min)) {

            params.set(
                'min_salary',
                min
            );
        }


        if (!Number.isNaN(max)) {

            params.set(
                'max_salary',
                max
            );
        }
    }


    // --------------------------------------------------------
    // AI Score
    // --------------------------------------------------------

    if (score !== '') {

        const minScore =
            Number(score);


        if (!Number.isNaN(minScore)) {

            params.set(
                'min_score',
                minScore
            );


            if (minScore === 80) {

                params.set(
                    'max_score',
                    100
                );

            } else if (minScore === 50) {

                params.set(
                    'max_score',
                    79
                );

            } else if (minScore === 0) {

                params.set(
                    'max_score',
                    49
                );
            }
        }
    }


    return params;
}


// ============================================================
// API HELPER
// ============================================================

async function apiCall(
    endpoint,
    options = {}
) {

    const url =
        API_BASE + endpoint;


    console.log(
        `📤 Calling API: ${url}`
    );


    try {

        const response =
            await fetch(
                url,
                {
                    ...options,

                    headers: {
                        'Accept':
                            'application/json',

                        ...(options.headers || {})
                    }
                }
            );


        if (!response.ok) {

            let message =
                response.statusText ||
                `HTTP ${response.status}`;


            try {

                const error =
                    await response.json();


                if (error.detail) {

                    message =
                        error.detail;
                }

            } catch (_) {

                // Server did not return JSON.
            }


            throw new Error(
                message
            );
        }


        return await response.json();

    } catch (error) {

        console.error(
            '❌ API Error:',
            error
        );

        throw error;
    }
}


// ============================================================
// GLOBAL STATE
// ============================================================

let currentPage = 1;
let totalPages = 1;
let totalCandidates = 0;


// ============================================================
// AUTHENTICATION
// ============================================================

const AUTH_TOKEN_KEY =
    'resume_screening_auth_token';

const AUTH_USER_KEY =
    'resume_screening_auth_user';


// ------------------------------------------------------------
// Authentication state
// ------------------------------------------------------------

function setAuthState(
    token,
    user
) {

    localStorage.setItem(
        AUTH_TOKEN_KEY,
        token
    );


    localStorage.setItem(
        AUTH_USER_KEY,
        JSON.stringify(
            user || {}
        )
    );
}


function clearAuthState() {

    localStorage.removeItem(
        AUTH_TOKEN_KEY
    );

    localStorage.removeItem(
        AUTH_USER_KEY
    );
}


function getAuthToken() {

    return localStorage.getItem(
        AUTH_TOKEN_KEY
    );
}


function getStoredUser() {

    try {

        return JSON.parse(
            localStorage.getItem(
                AUTH_USER_KEY
            ) || 'null'
        );

    } catch (_) {

        return null;
    }
}


// ------------------------------------------------------------
// Authentication message
// ------------------------------------------------------------

function showAuthMessage(
    message,
    success = false
) {

    const element =
        $('#authMessage');


    if (!element) {

        return;
    }


    element.textContent =
        message || '';


    element.classList.toggle(
        'success',
        success
    );
}


// ------------------------------------------------------------
// Show Login form
// ------------------------------------------------------------

function showLoginForm() {

    const loginForm =
        $('#loginForm');

    const registerForm =
        $('#registerForm');

    const loginTab =
        $('#loginTab');

    const registerTab =
        $('#registerTab');


    if (loginForm) {

        loginForm.classList.remove(
            'hidden'
        );
    }


    if (registerForm) {

        registerForm.classList.add(
            'hidden'
        );
    }


    if (loginTab) {

        loginTab.classList.add(
            'active'
        );
    }


    if (registerTab) {

        registerTab.classList.remove(
            'active'
        );
    }


    showAuthMessage('');
}


// ------------------------------------------------------------
// Show Register form
// ------------------------------------------------------------

function showRegisterForm() {

    const loginForm =
        $('#loginForm');

    const registerForm =
        $('#registerForm');

    const loginTab =
        $('#loginTab');

    const registerTab =
        $('#registerTab');


    if (loginForm) {

        loginForm.classList.add(
            'hidden'
        );
    }


    if (registerForm) {

        registerForm.classList.remove(
            'hidden'
        );
    }


    if (loginTab) {

        loginTab.classList.remove(
            'active'
        );
    }


    if (registerTab) {

        registerTab.classList.add(
            'active'
        );
    }


    showAuthMessage('');
}


// ------------------------------------------------------------
// Show dashboard
// ------------------------------------------------------------

function showDashboard(user) {

    document.body.classList.add(
        'authenticated'
    );


    const currentUser =
        $('#currentUser');


    if (
        currentUser &&
        user
    ) {

        const roleLabels = {

            candidate:
                'Candidate',

            recruiter:
                'Recruiter',

            company_admin:
                'Company Admin'
        };


        currentUser.textContent =
            `${user.name || user.email} · ${
                roleLabels[user.role] ||
                user.role ||
                ''
            }`;
    }


    const authScreen =
        $('#authScreen');


    if (authScreen) {

        authScreen.style.display =
            'none';
    }
}


// ------------------------------------------------------------
// Show authentication screen
// ------------------------------------------------------------

function showAuthScreen() {

    document.body.classList.remove(
        'authenticated'
    );


    const authScreen =
        $('#authScreen');


    if (authScreen) {

        authScreen.style.display =
            'flex';
    }


    showLoginForm();
}


// ============================================================
// SETUP AUTHENTICATION
// ============================================================

function setupAuthentication() {

    const loginTab =
        $('#loginTab');

    const registerTab =
        $('#registerTab');

    const loginForm =
        $('#loginForm');

    const registerForm =
        $('#registerForm');

    const logoutBtn =
        $('#logoutBtn');


    // --------------------------------------------------------
    // LOGIN TAB
    // --------------------------------------------------------

    if (loginTab) {

        loginTab.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                showLoginForm();
            }
        );
    }


    // --------------------------------------------------------
    // REGISTER TAB
    // --------------------------------------------------------

    if (registerTab) {

        registerTab.addEventListener(
            'click',
            (event) => {

                event.preventDefault();

                showRegisterForm();
            }
        );
    }


    // --------------------------------------------------------
    // LOGIN FORM
    // --------------------------------------------------------

    if (loginForm) {

        loginForm.addEventListener(
            'submit',
            async (event) => {

                event.preventDefault();


                const email =
                    $('#loginEmail')
                        ?.value
                        .trim() || '';


                const password =
                    $('#loginPassword')
                        ?.value || '';


                if (
                    !email ||
                    !password
                ) {

                    showAuthMessage(
                        'Please enter your email and password.'
                    );

                    return;
                }


                const submitButton =
                    loginForm.querySelector(
                        'button[type="submit"]'
                    );


                const originalText =
                    submitButton
                        ?.textContent ||
                    'Login';


                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        'Logging in...';
                }


                showAuthMessage('');


                try {

                    const formData =
                        new FormData();


                    formData.append(
                        'email',
                        email
                    );


                    formData.append(
                        'password',
                        password
                    );


                    const result =
                        await apiCall(
                            '/auth/login',
                            {
                                method: 'POST',
                                body: formData
                            }
                        );


                    if (
                        !result ||
                        !result.token ||
                        !result.user
                    ) {

                        throw new Error(
                            'Invalid login response from server.'
                        );
                    }


                    setAuthState(
                        result.token,
                        result.user
                    );


                    showDashboard(
                        result.user
                    );


                    loginForm.reset();


                    await initializeDashboard();

                } catch (error) {

                    console.error(
                        '❌ Login failed:',
                        error
                    );


                    showAuthMessage(
                        error.message ||
                        'Login failed. Please check your credentials.'
                    );

                } finally {

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            originalText;
                    }
                }
            }
        );
    }


    // --------------------------------------------------------
    // REGISTER FORM
    // --------------------------------------------------------

    if (registerForm) {

        registerForm.addEventListener(
            'submit',
            async (event) => {

                event.preventDefault();


                const name =
                    $('#registerName')
                        ?.value
                        .trim() || '';


                const email =
                    $('#registerEmail')
                        ?.value
                        .trim() || '';


                const password =
                    $('#registerPassword')
                        ?.value || '';


                const role =
                    $('#registerRole')
                        ?.value || '';


                if (
                    !name ||
                    !email ||
                    !password ||
                    !role
                ) {

                    showAuthMessage(
                        'Please complete all registration fields.'
                    );

                    return;
                }


                if (
                    password.length < 8
                ) {

                    showAuthMessage(
                        'Password must be at least 8 characters.'
                    );

                    return;
                }


                const submitButton =
                    registerForm.querySelector(
                        'button[type="submit"]'
                    );


                const originalText =
                    submitButton
                        ?.textContent ||
                    'Create account';


                if (submitButton) {

                    submitButton.disabled =
                        true;

                    submitButton.textContent =
                        'Creating account...';
                }


                showAuthMessage('');


                try {

                    const formData =
                        new FormData();


                    formData.append(
                        'name',
                        name
                    );


                    formData.append(
                        'email',
                        email
                    );


                    formData.append(
                        'password',
                        password
                    );


                    formData.append(
                        'role',
                        role
                    );


                    await apiCall(
                        '/auth/register',
                        {
                            method: 'POST',
                            body: formData
                        }
                    );


                    /*
                     * Registration succeeded.
                     *
                     * Do not automatically log the user in.
                     * Return to Login and fill the email field.
                     */

                    registerForm.reset();


                    showLoginForm();


                    const loginEmail =
                        $('#loginEmail');


                    if (loginEmail) {

                        loginEmail.value =
                            email;

                        loginEmail.focus();
                    }


                    showAuthMessage(
                        'Account created successfully. You can now log in.',
                        true
                    );

                } catch (error) {

                    console.error(
                        '❌ Registration failed:',
                        error
                    );


                    showAuthMessage(
                        error.message ||
                        'Registration failed.'
                    );

                } finally {

                    if (submitButton) {

                        submitButton.disabled =
                            false;

                        submitButton.textContent =
                            originalText;
                    }
                }
            }
        );
    }


    // --------------------------------------------------------
    // LOGOUT
    // --------------------------------------------------------

    if (logoutBtn) {

        logoutBtn.addEventListener(
            'click',
            async () => {

                const token =
                    getAuthToken();


                try {

                    if (token) {

                        const formData =
                            new FormData();


                        formData.append(
                            'token',
                            token
                        );


                        await apiCall(
                            '/auth/logout',
                            {
                                method: 'POST',
                                body: formData
                            }
                        );
                    }

                } catch (error) {

                    console.warn(
                        'Logout request failed:',
                        error
                    );

                } finally {

                    clearAuthState();

                    window.location.reload();
                }
            }
        );
    }
}


// ============================================================
// INITIALIZE DASHBOARD
// ============================================================

async function initializeDashboard() {

    console.log(
        '🚀 Initializing dashboard...'
    );


    try {

        await loadRoles();


        await Promise.all([
            loadCandidates(),
            loadAnalytics()
        ]);


        setupEventListeners();


        setupFormSubmission();


        console.log(
            '🎉 Dashboard is ready'
        );

    } catch (error) {

        console.error(
            '❌ Dashboard initialization failed:',
            error
        );


        const rows =
            $('#rows');


        if (rows) {

            rows.innerHTML = `
                <tr>
                    <td
                        colspan="10"
                        class="error-row"
                    >
                        ${escapeHTML(
                            error.message
                        )}
                    </td>
                </tr>
            `;
        }
    }
}


// ============================================================
// CHECK EXISTING LOGIN SESSION
// ============================================================

async function checkAuthentication() {

    const token =
        getAuthToken();


    if (!token) {

        showAuthScreen();

        return;
    }


    try {

        const user =
            await apiCall(
                '/auth/me?token=' +
                encodeURIComponent(token)
            );


        localStorage.setItem(
            AUTH_USER_KEY,
            JSON.stringify(user)
        );


        showDashboard(
            user
        );


        await initializeDashboard();

    } catch (error) {

        console.warn(
            'Stored session is invalid. Showing login screen.'
        );


        clearAuthState();

        showAuthScreen();
    }
}


// ============================================================
// RESUME UPLOAD / SCREENING
// ============================================================

function setupFormSubmission() {

    const form =
        $('#screenForm');


    if (!form) {

        console.error(
            '❌ Resume form not found'
        );

        return;
    }


    form.addEventListener(
        'submit',
        async (event) => {

            event.preventDefault();


            console.log(
                '🔥🔥🔥 RESUME FORM SUBMITTED 🔥🔥🔥'
            );


            const fileInput =
                $('#resume');


            console.log(
                '📄 File input:',
                fileInput
            );


            console.log(
                '📁 Selected file:',
                fileInput?.files?.[0]
            );


            console.log(
                '🎯 Target role:',
                $('#targetRole')?.value
            );


            const file =
                fileInput?.files?.[0];


            const targetRole =
                $('#targetRole')?.value ||
                '';


            const salary =
                $('#salary')?.value ||
                '';


            const resultDiv =
                $('#result');


            const submitBtn =
                $('#submitBtn');


            // ------------------------------------------------
            // Validate file
            // ------------------------------------------------

            if (!file) {

                showUploadError(
                    'Please select a PDF or DOCX resume.'
                );

                return;
            }


            const extension =
                file.name
                    .toLowerCase()
                    .split('.')
                    .pop();


            if (
                !['pdf', 'docx']
                    .includes(extension)
            ) {

                showUploadError(
                    'Only PDF and DOCX resumes are accepted.'
                );

                return;
            }


            // ------------------------------------------------
            // Validate role
            // ------------------------------------------------

            if (!targetRole) {

                showUploadError(
                    'Please select a target job role.'
                );

                return;
            }


            // ------------------------------------------------
            // Build FormData
            // ------------------------------------------------

            const formData =
                new FormData();


            formData.append(
                'file',
                file
            );


            formData.append(
                'target_role',
                targetRole
            );


            if (
                salary !== '' &&
                !Number.isNaN(
                    Number(salary)
                )
            ) {

                formData.append(
                    'expected_salary',
                    Number(salary)
                );
            }


            // ------------------------------------------------
            // Loading state
            // ------------------------------------------------

            const originalText =
                submitBtn
                    ? submitBtn.textContent
                    : 'Analyze Resume';


            if (submitBtn) {

                submitBtn.disabled =
                    true;

                submitBtn.textContent =
                    'Analyzing Resume...';
            }


            if (resultDiv) {

                resultDiv.innerHTML = `
                    <div class="analysis-loading">

                        <div class="spinner"></div>

                        <strong>
                            Analyzing resume...
                        </strong>

                        <span>
                            Extracting profile and comparing
                            against historical hires.
                        </span>

                    </div>
                `;
            }


            // ------------------------------------------------
            // API request
            // ------------------------------------------------

            try {

                console.log(
                    '📄 Uploading:',
                    file.name
                );


                console.log(
                    '🎯 Target role:',
                    targetRole
                );


                const result =
                    await apiCall(
                        '/screen-resume',
                        {
                            method: 'POST',
                            body: formData
                        }
                    );


                console.log(
                    '✅ Analysis result:',
                    result
                );


                displayAnalysisResult(
                    result
                );

            } catch (error) {

                console.error(
                    '❌ Analysis failed:',
                    error
                );


                showUploadError(
                    error.message ||
                    'Resume analysis failed.'
                );

            } finally {

                if (submitBtn) {

                    submitBtn.disabled =
                        false;

                    submitBtn.textContent =
                        originalText;
                }
            }
        }
    );


    // ========================================================
    // FILE INPUT
    // ========================================================

    const resumeInput =
        $('#resume');


    const fileName =
        $('#fileName');


    const uploadDropzone =
        $('#uploadDropzone');


    if (resumeInput) {

        resumeInput.addEventListener(
            'change',
            () => {

                const file =
                    resumeInput.files?.[0];


                if (fileName) {

                    fileName.textContent =
                        file
                            ? file.name
                            : 'No file chosen';


                    fileName.classList.toggle(
                        'has-file',
                        !!file
                    );
                }


                if (uploadDropzone) {

                    uploadDropzone.classList.toggle(
                        'has-file',
                        !!file
                    );
                }
            }
        );
    }


    // ========================================================
    // DRAG & DROP
    // ========================================================

    if (uploadDropzone) {

        [
            'dragenter',
            'dragover'
        ].forEach(
            eventName => {

                uploadDropzone.addEventListener(
                    eventName,
                    (event) => {

                        event.preventDefault();


                        uploadDropzone.classList.add(
                            'dragging'
                        );
                    }
                );
            }
        );


        [
            'dragleave',
            'drop'
        ].forEach(
            eventName => {

                uploadDropzone.addEventListener(
                    eventName,
                    (event) => {

                        event.preventDefault();


                        uploadDropzone.classList.remove(
                            'dragging'
                        );
                    }
                );
            }
        );


        uploadDropzone.addEventListener(
            'drop',
            (event) => {

                const files =
                    event.dataTransfer.files;


                if (
                    !files?.length ||
                    !resumeInput
                ) {

                    return;
                }


                const droppedFile =
                    files[0];


                const extension =
                    droppedFile.name
                        .toLowerCase()
                        .split('.')
                        .pop();


                if (
                    !['pdf', 'docx']
                        .includes(extension)
                ) {

                    showUploadError(
                        'Only PDF and DOCX resumes are accepted.'
                    );

                    return;
                }


                try {

                    const dataTransfer =
                        new DataTransfer();


                    dataTransfer.items.add(
                        droppedFile
                    );


                    resumeInput.files =
                        dataTransfer.files;


                    resumeInput.dispatchEvent(
                        new Event(
                            'change',
                            {
                                bubbles: true
                            }
                        )
                    );

                } catch (error) {

                    console.warn(
                        'Could not attach dropped file:',
                        error
                    );
                }
            }
        );
    }
}


// ============================================================
// UPLOAD ERROR
// ============================================================

function showUploadError(message) {

    const resultDiv =
        $('#result');


    if (!resultDiv) {

        return;
    }


    resultDiv.innerHTML = `

        <div class="analysis-error">

            <div class="error-icon">
                !
            </div>

            <div>

                <strong>
                    Analysis failed
                </strong>

                <p>
                    ${escapeHTML(message)}
                </p>

            </div>

        </div>
    `;
}


// ============================================================
// DISPLAY SCREENING RESULT
// ============================================================

function displayAnalysisResult(result) {

    const resultDiv =
        $('#result');


    if (
        !result ||
        !result.profile
    ) {

        showUploadError(
            'The server returned an invalid analysis response.'
        );

        return;
    }


    const decisionClass =
        String(
            result.decision || ''
        )
        .toLowerCase()
        .replace(
            /\s+/g,
            '-'
        );


    const matchedSkills =
        result.matched_skills || [];


    const missingSkills =
        result.missing_skills || [];


    const score =
        Number(
            result.score
        ) || 0;


    const safeScore =
        Math.max(
            0,
            Math.min(
                100,
                score
            )
        );


    resultDiv.innerHTML = `

        <div class="analysis-result">

            <!-- HEADER -->

            <div class="result-header">

                <div>

                    <span class="eyebrow">
                        SCREENING RESULT
                    </span>

                    <h4>
                        ${escapeHTML(
                            result.profile.name ||
                            'Candidate'
                        )}
                    </h4>

                    <p>
                        ${escapeHTML(
                            result.target_role ||
                            ''
                        )}
                    </p>

                </div>


                <span
                    class="decision-badge ${decisionClass}"
                >
                    ${escapeHTML(
                        result.decision ||
                        'Unknown'
                    )}
                </span>

            </div>


            <!-- SCORE -->

            <div class="score-display">

                <div>

                    <span class="score-caption">
                        AI SCREENING SCORE
                    </span>

                    <strong>
                        ${escapeHTML(
                            result.score
                        )}
                    </strong>

                </div>


                <div
                    class="score-ring"
                    style="--score:${safeScore}%"
                >
                </div>

            </div>


            <!-- BASIC INFORMATION -->

            <div class="result-grid">

                <div class="result-item">

                    <span class="label">
                        Rank
                    </span>

                    <strong>
                        #${escapeHTML(
                            result.rank
                        )}

                        <small>
                            of ${escapeHTML(
                                result.benchmark_size
                            )}
                        </small>
                    </strong>

                </div>


                <div class="result-item">

                    <span class="label">
                        Experience
                    </span>

                    <strong>
                        ${escapeHTML(
                            result.profile
                                .experience_years
                        )}
                        years
                    </strong>

                </div>


                <div class="result-item">

                    <span class="label">
                        Projects
                    </span>

                    <strong>
                        ${escapeHTML(
                            result.profile
                                .projects_count
                        )}
                    </strong>

                </div>


                <div class="result-item">

                    <span class="label">
                        Education
                    </span>

                    <strong>
                        ${escapeHTML(
                            result.profile
                                .education
                        )}
                    </strong>

                </div>

            </div>


            <!-- MATCHED SKILLS -->

            <div class="skills-section">

                <h5>
                    Matched Skills
                </h5>

                <div class="skills-list">

                    ${
                        matchedSkills.length

                        ? matchedSkills
                            .slice(0, 10)
                            .map(
                                skill =>
                                    `
                                    <span
                                        class="skill-tag"
                                    >
                                        ${escapeHTML(
                                            skill
                                        )}
                                    </span>
                                    `
                            )
                            .join('')

                        : `
                            <span class="muted">
                                No benchmark skills matched.
                            </span>
                        `
                    }

                </div>

            </div>


            <!-- MISSING SKILLS -->

            <div
                class="skills-section missing-skills"
            >

                <h5>
                    Skills to Strengthen
                </h5>

                <div class="skills-list">

                    ${
                        missingSkills.length

                        ? missingSkills
                            .slice(0, 8)
                            .map(
                                skill =>
                                    `
                                    <span
                                        class="skill-tag missing"
                                    >
                                        ${escapeHTML(
                                            skill
                                        )}
                                    </span>
                                    `
                            )
                            .join('')

                        : `
                            <span class="muted">
                                No major benchmark gaps detected.
                            </span>
                        `
                    }

                </div>

            </div>


            <!-- RECOMMENDATION -->

            <div class="recommendation">

                <h5>
                    Recommendation
                </h5>

                <p>
                    ${escapeHTML(
                        result.feedback || ''
                    )}
                </p>

            </div>

        </div>
    `;
}


// ============================================================
// LOAD ROLES
// ============================================================

async function loadRoles() {

    const roles =
        await apiCall(
            '/roles'
        );


    const roleSelect =
        $('#role');


    const targetRoleSelect =
        $('#targetRole');


    // --------------------------------------------------------
    // Candidate filter
    // --------------------------------------------------------

    if (roleSelect) {

        roleSelect.innerHTML =
            '<option value="">All Roles</option>';


        roles.forEach(
            role => {

                roleSelect.add(
                    new Option(
                        role,
                        role
                    )
                );
            }
        );
    }


    // --------------------------------------------------------
    // Resume analyzer
    // --------------------------------------------------------

    if (targetRoleSelect) {

        targetRoleSelect.innerHTML =
            '<option value="">Select Role</option>';


        roles.forEach(
            role => {

                targetRoleSelect.add(
                    new Option(
                        role,
                        role
                    )
                );
            }
        );
    }


    console.log(
        `✅ Loaded ${roles.length} roles`
    );
}


// ============================================================
// LOAD CANDIDATES
// ============================================================

async function loadCandidates() {

    try {

        const params =
            buildFilterParams(
                true
            );


        const data =
            await apiCall(
                '/candidates?' +
                params.toString()
            );


        totalCandidates =
            Number(
                data.total || 0
            );


        totalPages =
            Math.max(
                1,
                Math.ceil(
                    totalCandidates / 20
                )
            );


        const totalElement =
            $('#totalCandidates');


        if (totalElement) {

            totalElement.textContent =
                totalCandidates
                    .toLocaleString();
        }


        renderTable(
            data.items || []
        );


        updatePagination();

    } catch (error) {

        console.error(
            '❌ Failed to load candidates:',
            error
        );


        const rowsContainer =
            $('#rows');


        if (rowsContainer) {

            rowsContainer.innerHTML = `

                <tr>

                    <td
                        colspan="10"
                        class="error-row"
                    >
                        ${escapeHTML(
                            error.message
                        )}
                    </td>

                </tr>
            `;
        }
    }
}


// ============================================================
// RENDER CANDIDATE TABLE
// ============================================================

function renderTable(candidates) {

    const rowsContainer =
        $('#rows');


    if (!rowsContainer) {

        return;
    }


    if (!candidates.length) {

        rowsContainer.innerHTML = `

            <tr>

                <td
                    colspan="10"
                    class="empty-row"
                >
                    No candidates match
                    the selected filters.
                </td>

            </tr>
        `;

        return;
    }


    rowsContainer.innerHTML =
        candidates
            .map(
                candidate => {

                    const score =
                        Number(
                            candidate.AI_Score ||
                            0
                        );


                    const decision =
                        candidate.Recruiter_Decision ||
                        '';


                    const skills =
                        candidate.Skills ||
                        '';


                    return `

                        <tr>

                            <td>
                                ${escapeHTML(
                                    candidate.Resume_ID ||
                                    ''
                                )}
                            </td>


                            <td
                                class="candidate-name"
                            >

                                ${escapeHTML(
                                    candidate.Name ||
                                    ''
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    candidate.Job_Role ||
                                    ''
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    candidate.Experience_Years ??
                                    0
                                )}

                                yrs

                            </td>


                            <td>

                                ${escapeHTML(
                                    candidate.Education ||
                                    ''
                                )}

                            </td>


                            <td
                                class="skills-cell"
                                title="${escapeHTML(
                                    skills
                                )}"
                            >

                                ${escapeHTML(
                                    skills ||
                                    '—'
                                )}

                            </td>


                            <td>

                                ${escapeHTML(
                                    candidate.Projects_Count ??
                                    0
                                )}

                            </td>


                            <td>

                                $${Number(
                                    candidate.Salary_Expectation ||
                                    0
                                ).toLocaleString()}

                            </td>


                            <td>

                                <span
                                    class="ai-score ${getScoreClass(
                                        score
                                    )}"
                                >
                                    ${score}
                                </span>

                            </td>


                            <td>

                                <span
                                    class="decision ${decision
                                        .toLowerCase()
                                        .replace(
                                            /\s+/g,
                                            '-'
                                        )}"
                                >
                                    ${escapeHTML(
                                        decision
                                    )}
                                </span>

                            </td>

                        </tr>

                    `;
                }
            )
            .join('');
}


// ============================================================
// SCORE COLOR CLASS
// ============================================================

function getScoreClass(score) {

    if (score >= 80) {

        return 'score-high';
    }


    if (score >= 50) {

        return 'score-medium';
    }


    return 'score-low';
}


// ============================================================
// PAGINATION
// ============================================================

function updatePagination() {

    const pageInfo =
        $('#pageInfo');


    const previous =
        $('#previous');


    const next =
        $('#next');


    if (pageInfo) {

        pageInfo.textContent =
            `Page ${currentPage} of ${totalPages}`;
    }


    if (previous) {

        previous.disabled =
            currentPage <= 1;
    }


    if (next) {

        next.disabled =
            currentPage >= totalPages;
    }
}


// ============================================================
// APPLY ALL FILTERS
// ============================================================

async function applyAllFilters() {

    currentPage = 1;


    await Promise.all([
        loadCandidates(),
        loadAnalytics()
    ]);
}


// ============================================================
// EVENT LISTENERS
// ============================================================

function setupEventListeners() {

    // --------------------------------------------------------
    // Apply filters
    // --------------------------------------------------------

    const applyFiltersBtn =
        $('#applyFilters');


    if (applyFiltersBtn) {

        applyFiltersBtn.addEventListener(
            'click',
            applyAllFilters
        );
    }


    // --------------------------------------------------------
    // Previous page
    // --------------------------------------------------------

    const previousBtn =
        $('#previous');


    if (previousBtn) {

        previousBtn.addEventListener(
            'click',
            async () => {

                if (currentPage > 1) {

                    currentPage--;

                    await loadCandidates();
                }
            }
        );
    }


    // --------------------------------------------------------
    // Next page
    // --------------------------------------------------------

    const nextBtn =
        $('#next');


    if (nextBtn) {

        nextBtn.addEventListener(
            'click',
            async () => {

                if (
                    currentPage <
                    totalPages
                ) {

                    currentPage++;

                    await loadCandidates();
                }
            }
        );
    }


    // --------------------------------------------------------
    // Search with Enter
    // --------------------------------------------------------

    const searchInput =
        $('#search');


    if (searchInput) {

        searchInput.addEventListener(
            'keydown',
            (event) => {

                if (
                    event.key ===
                    'Enter'
                ) {

                    applyAllFilters();
                }
            }
        );
    }


    // --------------------------------------------------------
    // Export buttons
    // --------------------------------------------------------

    const exportFiltered =
        $('#exportFiltered');


    const exportFiltered2 =
        $('#exportFiltered2');


    const exportAll =
        $('#exportAll');


    const exportAll2 =
        $('#exportAll2');


    [
        exportFiltered,
        exportFiltered2
    ].forEach(
        button => {

            if (button) {

                button.addEventListener(
                    'click',
                    () =>
                        exportData(false)
                );
            }
        }
    );


    [
        exportAll,
        exportAll2
    ].forEach(
        button => {

            if (button) {

                button.addEventListener(
                    'click',
                    () =>
                        exportData(true)
                );
            }
        }
    );
}


// ============================================================
// EXPORT DATA
// ============================================================

async function exportData(
    all = false
) {

    try {

        const params =
            buildFilterParams(
                false
            );


        params.set(
            'page',
            1
        );


        params.set(
            'page_size',
            1000
        );


        params.set(
            'sort',
            'AI_Score'
        );


        params.set(
            'direction',
            'desc'
        );


        // Full export = remove filters

        if (all) {

            [
                'role',
                'decision',
                'certification',
                'search',
                'min_experience',
                'max_experience',
                'min_salary',
                'max_salary',
                'min_score',
                'max_score'
            ].forEach(
                key =>
                    params.delete(key)
            );
        }


        const data =
            await apiCall(
                '/candidates?' +
                params.toString()
            );


        const candidates =
            data.items || [];


        const headers = [

            'Resume_ID',
            'Name',
            'Job_Role',
            'Experience_Years',
            'Education',
            'Skills',
            'Certifications',
            'Projects_Count',
            'Salary_Expectation',
            'AI_Score',
            'Recruiter_Decision'

        ];


        const csvRows = [

            headers.join(','),

            ...candidates.map(
                candidate =>

                    headers
                        .map(
                            header => {

                                const value =
                                    candidate[header] ??
                                    '';


                                return JSON.stringify(
                                    value
                                );
                            }
                        )
                        .join(',')
            )
        ];


        const blob =
            new Blob(
                [
                    csvRows.join('\n')
                ],
                {
                    type:
                        'text/csv;charset=utf-8;'
                }
            );


        const url =
            URL.createObjectURL(
                blob
            );


        const link =
            document.createElement(
                'a'
            );


        link.href =
            url;


        link.download =
            all
                ? 'all_candidates.csv'
                : 'filtered_candidates.csv';


        document.body.appendChild(
            link
        );


        link.click();


        link.remove();


        URL.revokeObjectURL(
            url
        );


        console.log(
            `✅ Exported ${candidates.length} candidates`
        );

    } catch (error) {

        console.error(
            '❌ Export failed:',
            error
        );


        alert(
            `Export failed: ${error.message}`
        );
    }
}


// ============================================================
// ANALYTICS
// ============================================================

async function loadAnalytics() {

    try {

        const params =
            buildFilterParams(
                false
            );


        const data =
            await apiCall(
                '/analytics?' +
                params.toString()
            );


        console.log(
            '📊 Analytics data:',
            data
        );


        updateAnalyticsSummary(
            data.summary || {}
        );


        updateHireRatioChart(
            data.by_role || []
        );


        updateAvgSalaryChart(
            data.salaries || []
        );


        updateTopSkillsChart(
            data.skills || []
        );


        updateScoreDecisionChart(
            data.score_decisions || []
        );


        updateExperienceChart(
            data.experience || []
        );


        return data;

    } catch (error) {

        console.error(
            '❌ Failed to load analytics:',
            error
        );


        const chartIds = [

            'hireRatioChart',
            'avgSalaryChart',
            'topSkillsChart',
            'scoreDecisionChart',
            'experienceChart'

        ];


        chartIds.forEach(
            id => {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.innerHTML = `

                        <div class="chart-error">

                            Failed to load chart data:

                            ${escapeHTML(
                                error.message
                            )}

                        </div>

                    `;
                }
            }
        );


        return {};
    }
}


// ============================================================
// ANALYTICS SUMMARY
// ============================================================

function updateAnalyticsSummary(
    summary
) {

    const values = {

        analyticsCandidates:
            summary.candidates ||
            0,

        analyticsHires:
            summary.hires ||
            0,

        analyticsRejects:
            summary.rejects ||
            0
    };


    Object.entries(values)
        .forEach(
            ([id, value]) => {

                const element =
                    document.getElementById(
                        id
                    );


                if (element) {

                    element.textContent =
                        Number(
                            value
                        ).toLocaleString();
                }
            }
        );
}


// ============================================================
// EMPTY CHART STATE
// ============================================================

function renderEmpty(element) {

    element.innerHTML = `

        <div class="chart-empty">

            <span>
                No data available
            </span>

            <small>
                Try changing or clearing
                the candidate filters.
            </small>

        </div>
    `;
}


// ============================================================
// HIRE VS REJECT CHART
// ============================================================

function updateHireRatioChart(data) {

    const chartElement =
        $('#hireRatioChart');


    if (!chartElement) {

        return;
    }


    chartElement.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const maxCandidates =
        Math.max(
            ...data.map(
                item =>
                    Number(
                        item.candidates
                    ) || 0
            ),
            1
        );


    const container =
        document.createElement(
            'div'
        );


    container.className =
        'horizontal-chart';


    data.forEach(
        item => {

            const candidates =
                Number(
                    item.candidates
                ) || 0;


            const hires =
                Number(
                    item.hires
                ) || 0;


            const rejects =
                Number(
                    item.rejects
                ) ||
                Math.max(
                    0,
                    candidates - hires
                );


            const hireRate =
                candidates
                    ? Math.round(
                        (hires /
                            candidates) *
                        100
                    )
                    : 0;


            const row =
                document.createElement(
                    'div'
                );


            row.className =
                'metric-row';


            const candidateWidth =
                candidates
                    ? (
                        candidates /
                        maxCandidates
                    ) * 100
                    : 0;


            row.innerHTML = `

                <div class="metric-row-head">

                    <strong>
                        ${escapeHTML(
                            item.Job_Role
                        )}
                    </strong>

                    <span>
                        ${hireRate}% hire rate
                    </span>

                </div>


                <div class="metric-track">

                    <div
                        class="metric-fill hire"
                        style="width:${Math.max(
                            4,
                            candidateWidth
                        )}%"
                    >
                        <span>
                            ${hires} Hires
                        </span>
                    </div>


                    <div
                        class="metric-reject"
                        style="width:${Math.max(
                            0,
                            candidateWidth *
                            (
                                rejects /
                                Math.max(
                                    candidates,
                                    1
                                )
                            )
                        )}%"
                    >

                        ${
                            rejects
                                ? `<span>${rejects} Rejects</span>`
                                : ''
                        }

                    </div>

                </div>
            `;


            container.appendChild(
                row
            );
        }
    );


    chartElement.appendChild(
        container
    );
}


// ============================================================
// AVERAGE SALARY CHART
// ============================================================

function updateAvgSalaryChart(data) {

    const chartElement =
        $('#avgSalaryChart');


    if (!chartElement) {

        return;
    }


    chartElement.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const maxSalary =
        Math.max(
            ...data.map(
                item =>
                    Number(
                        item.average_salary
                    ) || 0
            ),
            1
        );


    const container =
        document.createElement(
            'div'
        );


    container.className =
        'horizontal-chart';


    data.forEach(
        item => {

            const salary =
                Number(
                    item.average_salary
                ) || 0;


            const row =
                document.createElement(
                    'div'
                );


            row.className =
                'metric-row salary-row';


            const percentage =
                salary
                    ? (
                        salary /
                        maxSalary
                    ) * 100
                    : 0;


            row.innerHTML = `

                <div class="metric-row-head">

                    <strong>
                        ${escapeHTML(
                            item.Job_Role
                        )}
                    </strong>

                    <span>
                        $${salary.toLocaleString()}
                    </span>

                </div>


                <div
                    class="metric-track salary-track"
                >

                    <div
                        class="metric-fill salary"
                        style="width:${Math.max(
                            4,
                            percentage
                        )}%"
                    >
                    </div>

                </div>

            `;


            container.appendChild(
                row
            );
        }
    );


    chartElement.appendChild(
        container
    );
}


// ============================================================
// TOP SKILLS CHART
// ============================================================

function updateTopSkillsChart(data) {

    const chartElement =
        $('#topSkillsChart');


    if (!chartElement) {

        return;
    }


    chartElement.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const skillsByRole = {};


    data.forEach(
        item => {

            const role =
                item.Job_Role ||
                'Other';


            if (
                !skillsByRole[role]
            ) {

                skillsByRole[role] =
                    [];
            }


            skillsByRole[role].push(
                item
            );
        }
    );


    const container =
        document.createElement(
            'div'
        );


    container.className =
        'skills-dashboard';


    Object.entries(
        skillsByRole
    ).forEach(
        ([role, skills]) => {

            skills.sort(
                (a, b) =>
                    Number(
                        b.frequency ||
                        0
                    ) -
                    Number(
                        a.frequency ||
                        0
                    )
            );


            const roleGroup =
                document.createElement(
                    'div'
                );


            roleGroup.className =
                'role-skills';


            roleGroup.innerHTML = `

                <h4>
                    ${escapeHTML(role)}
                </h4>

            `;


            const skillList =
                document.createElement(
                    'div'
                );


            skillList.className =
                'skills-list';


            skills
                .slice(0, 5)
                .forEach(
                    skill => {

                        const tag =
                            document.createElement(
                                'span'
                            );


                        tag.className =
                            'skill-tag';


                        tag.innerHTML = `

                            ${escapeHTML(
                                skill.Skill
                            )}

                            <em>
                                ${Number(
                                    skill.frequency ||
                                    0
                                )}
                            </em>

                        `;


                        skillList.appendChild(
                            tag
                        );
                    }
                );


            roleGroup.appendChild(
                skillList
            );


            container.appendChild(
                roleGroup
            );
        }
    );


    chartElement.appendChild(
        container
    );
}


// ============================================================
// AI SCORE DISTRIBUTION
// ============================================================

function updateScoreDecisionChart(
    data
) {

    const chartElement =
        $('#scoreDecisionChart');


    if (!chartElement) {

        return;
    }


    chartElement.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const total =
        data.reduce(
            (sum, item) =>
                sum +
                Number(
                    item.hires ||
                    0
                ) +
                Number(
                    item.rejects ||
                    0
                ),
            0
        );


    if (!total) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const container =
        document.createElement(
            'div'
        );


    container.className =
        'score-distribution';


    data.forEach(
        item => {

            const hires =
                Number(
                    item.hires ||
                    0
                );


            const rejects =
                Number(
                    item.rejects ||
                    0
                );


            const count =
                hires + rejects;


            const percentage =
                Math.round(
                    (
                        count /
                        total
                    ) * 100
                );


            const row =
                document.createElement(
                    'div'
                );


            row.className =
                'score-row';


            row.innerHTML = `

                <div class="score-row-head">

                    <strong>
                        ${escapeHTML(
                            item.score_band
                        )}
                    </strong>

                    <span>
                        ${percentage}%
                        ·
                        ${count}
                        candidates
                    </span>

                </div>


                <div class="score-bar-track">

                    <div
                        class="score-bar"
                        style="width:${Math.max(
                            2,
                            percentage
                        )}%"
                    >
                    </div>

                </div>


                <div class="score-row-meta">

                    <span
                        class="legend-dot hire-dot"
                    ></span>

                    ${hires} hires


                    <span
                        class="legend-dot reject-dot"
                    ></span>

                    ${rejects} rejects

                </div>

            `;


            container.appendChild(
                row
            );
        }
    );


    chartElement.appendChild(
        container
    );
}


// ============================================================
// EXPERIENCE DISTRIBUTION
// ============================================================

function updateExperienceChart(data) {

    const chartElement =
        $('#experienceChart');


    if (!chartElement) {

        return;
    }


    chartElement.innerHTML =
        '';


    if (
        !Array.isArray(data) ||
        data.length === 0
    ) {

        renderEmpty(
            chartElement
        );

        return;
    }


    const maxCount =
        Math.max(
            ...data.map(
                item =>
                    Number(
                        item.candidates
                    ) || 0
            ),
            1
        );


    const container =
        document.createElement(
            'div'
        );


    container.className =
        'experience-chart';


    data.forEach(
        item => {

            const years =
                Number(
                    item.Experience_Years
                ) || 0;


            const count =
                Number(
                    item.candidates
                ) || 0;


            const row =
                document.createElement(
                    'div'
                );


            row.className =
                'experience-row';


            const height =
                count
                    ? (
                        count /
                        maxCount
                    ) * 100
                    : 5;


            row.innerHTML = `

                <div class="experience-label">

                    ${years}

                    yr${years === 1 ? '' : 's'}

                </div>


                <div class="experience-track">

                    <div
                        class="experience-fill"
                        style="height:${Math.max(
                            5,
                            height
                        )}%"
                    >

                        <span>
                            ${count}
                        </span>

                    </div>

                </div>

            `;


            container.appendChild(
                row
            );
        }
    );


    chartElement.appendChild(
        container
    );
}


// ============================================================
// APPLICATION INITIALIZATION
// ============================================================

async function initialize() {

    console.log(
        '🚀 Initializing application...'
    );


    /*
     * Authentication is initialized first.
     *
     * The dashboard is loaded ONLY after:
     *
     * 1. A user logs in successfully, OR
     * 2. An existing valid session is found.
     */

    setupAuthentication();


    await checkAuthentication();
}


// ============================================================
// START APPLICATION
// ============================================================

if (
    document.readyState ===
    'loading'
) {

    document.addEventListener(
        'DOMContentLoaded',
        initialize
    );

} else {

    initialize();
}