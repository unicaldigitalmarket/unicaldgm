// =========================================
// 🚀 1. INITIALIZE SUPABASE
// =========================================
const SUPABASE_URL = 'https://tqukdcajpkhbunsxovjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxdWtkY2FqcGtoYnVuc3hvdmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzgyNDcsImV4cCI6MjA5MDIxNDI0N30.0a4luZi00muORofzbrg5eWgvZSU28ghQ2yYcBU-XL3I';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// 🛡️ SECURITY & UTILS
function escapeHTML(str) {
    if (!str) return '';
    return str.toString().replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag])
    );
}

function escapeJS(str) {
    if (!str) return '';
    return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;').replace(/\n/g, '\\n');
}

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 🚀 2. SMART CACHE & SCROLL (Detects if you clicked "Back")
const navEntries = performance.getEntriesByType("navigation");
const isBackNavigation = navEntries.length > 0 && navEntries[0].type === "back_forward";

window.addEventListener("beforeunload", () => {
    sessionStorage.setItem('scrollPos_' + window.location.pathname, window.scrollY);
});

function restorePageScroll() {
    if (isBackNavigation) {
        const scrollY = sessionStorage.getItem('scrollPos_' + window.location.pathname);
        if (scrollY) {
            setTimeout(() => window.scrollTo(0, parseInt(scrollY)), 50);
        }
    }
}

// 🚀 3. AUTHENTICATION
async function requireLogin(targetUrl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = targetUrl;
    } else {
        window.location.href = "login/index.html";
    }
}

// 🚀 4. LOAD DATA ON PAGE LOAD
document.addEventListener("DOMContentLoaded", async () => {
    setupSearch();
    setupExpandableFooter(); 
    checkGlobalBadges();
    fetchAdPopup(); 

    await Promise.all([
        fetchItems(),
        fetchVendors(),
        fetchReviews(),
        fetchBlogs()
    ]);
    
    restorePageScroll();
});

// 🚀 5. BADGES
async function checkGlobalBadges() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    try {
        const { data: chats } = await supabaseClient.from('chats')
            .select('customer_id, vendor_id, unread_by_customer, unread_by_vendor')
            .or(`customer_id.eq.${uid},vendor_id.eq.${uid}`);

        if (chats) {
            const hasUnreadMsg = chats.some(c => 
                (c.customer_id === uid && c.unread_by_customer === true) || 
                (c.vendor_id === uid && c.unread_by_vendor === true)
            );
            if (hasUnreadMsg) document.querySelectorAll('.msg-dot').forEach(dot => dot.style.display = 'block');
        }

        const lastClearedTime = new Date(localStorage.getItem('notifs_cleared_time') || '2000-01-01');
        const { data: notifs } = await supabaseClient.from('notifications')
            .select('user_id, is_read, created_at')
            .or(`user_id.eq.${uid},user_id.is.null`);
            
        if (notifs) {
            const hasUnreadNotif = notifs.some(n => {
                const notifTime = new Date(n.created_at);
                return (notifTime > lastClearedTime) && (n.is_read !== true);
            });
            if (hasUnreadNotif) document.querySelectorAll('.notify-dot').forEach(dot => dot.style.display = 'block');
        }
    } catch (e) { console.error("Badge check failed:", e); }
}

function setupSearch() {
    const searchInput = document.getElementById('main-search');
    const searchIcon = document.getElementById('search-btn-icon');

    if (!searchInput || !searchIcon) return;

    function executeSearch() {
        const query = searchInput.value.trim();
        if (query) window.location.href = `search/index.html?q=${encodeURIComponent(query)}`;
    }

    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') executeSearch();
    });
    
    searchIcon.addEventListener('click', executeSearch);
}

// =========================================
// --- FETCH ITEMS ---
// =========================================
async function fetchItems() {
    const grid = document.getElementById('product-grid');
    if (!grid) return; 

    const cachedData = sessionStorage.getItem('home_items');
    let displayItems = [];

    // ONLY use cache if they navigated BACK. If they refresh normally, fetch fresh data!
    if (isBackNavigation && cachedData) {
        displayItems = JSON.parse(cachedData);
    } else {
        try {
            const { data: products, error } = await supabaseClient.from('products').select('id, name, price, image_urls, category, is_pinned').eq('status', 'Active').order('is_pinned', { ascending: false }).limit(100);
            if (error) throw error;
            if (products.length === 0) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: #888;">No items posted yet.</p>`; return; }

            const pinnedItems = products.filter(p => p.is_pinned === true);
            let unpinnedItems = shuffleArray(products.filter(p => p.is_pinned !== true));
            displayItems = [...pinnedItems, ...unpinnedItems].slice(0, 50);

            sessionStorage.setItem('home_items', JSON.stringify(displayItems));
        } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: red;">Failed to load items.</p>`; return; }
    }

    grid.innerHTML = ""; 
    displayItems.forEach(p => {
        const imgUrl = escapeHTML((p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : 'https://via.placeholder.com/300?text=No+Image');
        const formattedPrice = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p.price);
        const pinBadge = p.is_pinned ? `<div style="position: absolute; top: 10px; left: 10px; background: rgba(0,0,0,0.7); color: white; padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 800; backdrop-filter: blur(4px);">Featured</div>` : '';

        grid.insertAdjacentHTML('beforeend', `
            <div class="card" style="position: relative;" onclick="window.location.href='product/index.html?id=${escapeJS(p.id)}'">
                ${pinBadge}
                <img src="${imgUrl}" class="card-img" onerror="this.src='https://via.placeholder.com/300'">
                <div class="card-price">${formattedPrice}</div>
                <div style="width: 100%; overflow: hidden;">
                    <div class="card-title">${escapeHTML(p.name)}</div>
                    <div class="card-desc">${escapeHTML(p.category)}</div>
                </div>
            </div>
        `);
    });
}

// =========================================
// --- FETCH VENDORS ---
// =========================================
async function fetchVendors() {
    const grid = document.getElementById('vendor-grid');
    if (!grid) return;

    const cachedData = sessionStorage.getItem('home_vendors');
    let displayVendors = [];

    if (isBackNavigation && cachedData) {
        displayVendors = JSON.parse(cachedData);
    } else {
        try {
            const { data: vendors, error } = await supabaseClient.from('vendors').select('id, business_name, description, logo_url, subscription_plan, is_pinned').eq('is_active', true).order('is_pinned', { ascending: false }).limit(100);
            if (error) throw error;
            if (vendors.length === 0) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: #888;">No vendors registered yet.</p>`; return; }

            const pinnedVendors = vendors.filter(v => v.is_pinned === true);
            let unpinnedVendors = shuffleArray(vendors.filter(v => v.is_pinned !== true));
            displayVendors = [...pinnedVendors, ...unpinnedVendors].slice(0, 30);

            sessionStorage.setItem('home_vendors', JSON.stringify(displayVendors));
        } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: red;">Failed to load vendors.</p>`; return; }
    }

    grid.innerHTML = "";
    displayVendors.forEach(v => {
        const logo = escapeHTML(v.logo_url || "https://via.placeholder.com/100");
        const nameTxt = escapeHTML(v.business_name ? v.business_name : 'Unknown');
        const descTxt = escapeHTML(v.description ? v.description.substring(0, 25) + '...' : 'Verified Seller');
        const pinBadge = v.is_pinned ? `<div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.7); color: #fbbf24; padding: 3px 8px; border-radius: 8px; font-size: 10px; font-weight: 800; backdrop-filter: blur(4px); z-index: 10;"><i class="fas fa-thumbtack"></i> Featured</div>` : '';

        let badgeColor = "#38bdf8"; 
        if (v.subscription_plan === "Influencer") badgeColor = "#fbbf24"; 
        if (v.subscription_plan === "Icon") badgeColor = "#1e293b"; 

        grid.insertAdjacentHTML('beforeend', `
            <div class="card" style="text-align: center; display: flex; flex-direction: column; align-items: center; height: 100%; position: relative;" onclick="window.location.href='vendors/profile/index.html?id=${escapeJS(v.id)}'">
                ${pinBadge}
                <img src="${logo}" style="width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 10px; flex-shrink: 0; object-fit: cover;" onerror="this.src='https://via.placeholder.com/100'">
                <div style="width: 100%; overflow: hidden;">
                    <div style="font-size: 13px; font-weight: 800; color: var(--text-main); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                        ${nameTxt} <i class="fas fa-check-circle" style="color: ${badgeColor};"></i>
                    </div>
                    <div style="margin-top: 5px; font-size: 11px; color: var(--text-muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${descTxt}</div>
                </div>
            </div>
        `);
    });
}

// =========================================
// --- FETCH REVIEWS (CACHED) ---
// =========================================
async function fetchReviews() {
    const slider = document.getElementById('reviews-slider');
    if(!slider) return;

    const cachedData = sessionStorage.getItem('home_reviews');
    let displayReviews = [];

    if (isBackNavigation && cachedData) {
        displayReviews = JSON.parse(cachedData);
    } else {
        try {
            // 🚀 FIX: Removed the legacy_name and legacy_avatar columns causing the crash
            const { data, error } = await supabaseClient.from('reviews').select('rating, review_text, profiles(full_name, avatar_url)').eq('status', 'approved').limit(20);
            if (error) throw error;
            if (data.length === 0) { slider.innerHTML = "<p style='padding:20px; color:#94a3b8; font-size:13px;'>No reviews yet.</p>"; return; }
            
            displayReviews = shuffleArray(data).slice(0, 5);
            sessionStorage.setItem('home_reviews', JSON.stringify(displayReviews));
        } catch (error) { 
            slider.innerHTML = "<p style='padding:20px; color:red;'>Failed to load reviews.</p>"; 
            console.error(error);
            return; 
        }
    }

    slider.innerHTML = "";
    displayReviews.forEach(r => {
        const name = escapeHTML(r.profiles?.full_name || "Student");
        const avatar = escapeHTML(r.profiles?.avatar_url || "img/person.png");
        const safeText = escapeHTML(r.review_text);
        
        slider.insertAdjacentHTML('beforeend', `
            <div class="review-card">
                <div class="rev-header">
                    <img src="${avatar}" class="rev-img" onerror="this.src='img/person.png'">
                    <div>
                        <div class="rev-name">${name} <i class="fas fa-check-circle" style="color: #10b981; font-size:10px;"></i></div>
                        <div class="rev-stars">${'<i class="fas fa-star"></i>'.repeat(r.rating)}</div>
                    </div>
                </div>
                <div class="rev-text">"${safeText}"</div>
            </div>
        `);
    });

    startReviewSlider();
}

function startReviewSlider() {
    const slider = document.getElementById('reviews-slider');
    if(!slider) return;
    setInterval(() => {
        const maxScroll = slider.scrollWidth - slider.clientWidth;
        if (slider.scrollLeft >= maxScroll - 10) {
            slider.scrollTo({ left: 0, behavior: 'smooth' });
        } else {
            slider.scrollBy({ left: 275, behavior: 'smooth' });
        }
    }, 2000); 
}

// =========================================
// --- FETCH BLOGS ---
// =========================================
async function fetchBlogs() {
    const list = document.getElementById('blog-list');
    if (!list) return;

    const cachedData = sessionStorage.getItem('home_blogs');
    let displayBlogs = [];

    if (isBackNavigation && cachedData) {
        displayBlogs = JSON.parse(cachedData);
    } else {
        try {
            const { data, error } = await supabaseClient.from('blogs').select('id, title, snippet, category, image_url, created_at').order('created_at', { ascending: false }).limit(5);
            if (error) throw error;
            if (data.length === 0) { list.innerHTML = "<p style='text-align:center; color:#94a3b8; font-size:13px;'>No news updates yet.</p>"; return; }
            
            displayBlogs = data;
            sessionStorage.setItem('home_blogs', JSON.stringify(displayBlogs));
        } catch (error) { list.innerHTML = "<p style='text-align:center; color:red;'>Failed to load news.</p>"; return; }
    }

    list.innerHTML = "";
    displayBlogs.forEach(b => {
        const imgUrl = escapeHTML(b.image_url || 'https://via.placeholder.com/100');
        const postDate = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const niceSlug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '--' + b.id;

       list.insertAdjacentHTML('beforeend', `
            <div class="blog-card" onclick="window.location.href='blog-content/index.html?id=${escapeJS(b.id)}'">
                <img src="${imgUrl}" class="blog-img" onerror="this.src='https://via.placeholder.com/100'">
                <div class="blog-info">
                    <div class="blog-cat-row">
                        <div class="blog-cat">${escapeHTML(b.category || 'News')}</div>
                        <div class="blog-date">${postDate}</div>
                    </div>
                    <div class="blog-title">${escapeHTML(b.title)}</div>
                    <div class="blog-desc">${escapeHTML(b.snippet)}</div>
                </div>
            </div>
        `);
    });
}

// =========================================
// --- FETCH AD POPUP ---
// =========================================
async function fetchAdPopup() {
    // 🚀 FIX: IF THIS IS NOT THE HOME PAGE, STOP RUNNING TO PREVENT CRASH!
    const adTitleEl = document.getElementById('ad-title');
    if (!adTitleEl) return; 

    try {
        const { data, error } = await supabaseClient.from('ads').select('*').eq('is_active', true);
        if (error || !data || data.length === 0) return;

        const randomAd = data[Math.floor(Math.random() * data.length)];

        adTitleEl.innerText = randomAd.title;
        document.getElementById('ad-content').innerText = randomAd.content;
        
        const adBtn = document.getElementById('ad-btn');
        if(randomAd.button_text) adBtn.innerText = randomAd.button_text;
        adBtn.href = randomAd.button_link || "#";

        const adImg = document.getElementById('ad-image');
        if (randomAd.image_url) {
            adImg.src = escapeHTML(randomAd.image_url);
            adImg.style.display = 'block';
        } else {
            adImg.style.display = 'none';
        }

        // Show popup
        setTimeout(() => {
            const popup = document.getElementById('ad-popup');
            if (popup) popup.style.display = 'flex';
        }, 1500);
        
    } catch (err) { console.error("Ad fetch error:", err); }
}

// =========================================
// 🚀 UI: EXPANDABLE FOOTER
// =========================================
function setupExpandableFooter() {
    const footer = document.getElementById('main-app-footer');
    const toggleBtn = document.getElementById('footer-expand-btn');
    const arrowIcon = document.getElementById('footer-arrow-icon');

    if(!footer || !toggleBtn) return;

    toggleBtn.addEventListener('click', () => {
        if(footer.classList.contains('collapsed')) {
            footer.classList.remove('collapsed');
            footer.classList.add('expanded');
            arrowIcon.classList.remove('fa-chevron-down');
            arrowIcon.classList.add('fa-chevron-up'); 
        } else {
            footer.classList.remove('expanded');
            footer.classList.add('collapsed');
            arrowIcon.classList.remove('fa-chevron-up');
            arrowIcon.classList.add('fa-chevron-down'); 
        }
    });
}

// =========================================
// 🌙 GLOBAL DARK MODE LOGIC
// =========================================
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

document.addEventListener("DOMContentLoaded", () => {
    const headerTop = document.querySelector('.header-top');
    
    if (headerTop) {
        const themeBtn = document.createElement('button');
        themeBtn.className = "theme-toggle-btn";
        
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        themeBtn.style.cssText = 'background:none; border:none; font-size:22px; color:var(--brand-color); cursor:pointer; margin-left: auto; margin-right: 15px; transition: 0.2s;';
        
        themeBtn.onclick = function() {
            const darkModeActive = document.body.classList.toggle('dark-mode');
            localStorage.setItem('theme', darkModeActive ? 'dark' : 'light');
            themeBtn.innerHTML = darkModeActive ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        };
        
        const notifyIcon = document.querySelector('.notify-icon-container');
        if (notifyIcon) {
            headerTop.insertBefore(themeBtn, notifyIcon);
        } else {
            headerTop.appendChild(themeBtn);
        }
    }
});

// =========================================
// ⚙️ SERVICE WORKER REGISTRATION
// =========================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Register your actual service worker file
        navigator.serviceWorker.register('sw.js')
            .then(reg => console.log('Service Worker Registered successfully!', reg.scope))
            .catch(err => console.error('Service Worker Registration Failed!', err));
    });
}

// =========================================
// 🚀 PWA INSTALL PROMPT LOGIC
// =========================================
let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent Chrome from showing the mini-infobar automatically
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
});

// This is the function triggered by your button in index.html
function downloadApp() {
    if (deferredPrompt) {
        // Show the native install prompt
        deferredPrompt.prompt();
        // Wait for the user to respond to the prompt
        deferredPrompt.userChoice.then((choiceResult) => {
            if (choiceResult.outcome === 'accepted') {
                console.log('User accepted the PWA install prompt');
            } else {
                console.log('User dismissed the PWA install prompt');
            }
            deferredPrompt = null;
        });
    } else {
        // Fallback message if the app is already installed or the browser doesn't support it
        alert("The app is already installed or your browser doesn't support direct installation. Try using Chrome or Safari!");
    }
}