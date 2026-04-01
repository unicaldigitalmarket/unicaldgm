// 🚀 1. INITIALIZE SUPABASE
const SUPABASE_URL = 'https://tqukdcajpkhbunsxovjf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRxdWtkY2FqcGtoYnVuc3hvdmpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2MzgyNDcsImV4cCI6MjA5MDIxNDI0N30.0a4luZi00muORofzbrg5eWgvZSU28ghQ2yYcBU-XL3I';
const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 🚀 2. AUTHENTICATION INTERCEPTOR
async function requireLogin(targetUrl) {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (session) {
        window.location.href = targetUrl;
    } else {
        window.location.href = "login/index.html";
    }
}

// 🚀 3. LOAD DATA ON PAGE LOAD
document.addEventListener("DOMContentLoaded", () => {
    setupSearch();
    fetchItems();
    fetchVendors();
    fetchReviews();
    fetchBlogs();
    setupExpandableFooter(); 
    checkGlobalBadges(); // 🚀 NEW: Checks for unread messages & notifications globally!
});

// 🚀 4. THE SMART BADGE CHECKER
async function checkGlobalBadges() {
    const { data: { session } } = await supabaseClient.auth.getSession();
    if (!session) return;
    const uid = session.user.id;

    try {
        // Check Unread Messages
        const { data: chats } = await supabaseClient.from('chats')
            .select('customer_id, vendor_id, unread_by_customer, unread_by_vendor')
            .or(`customer_id.eq.${uid},vendor_id.eq.${uid}`);

        if (chats) {
            const hasUnreadMsg = chats.some(c => 
                (c.customer_id === uid && c.unread_by_customer === true) || 
                (c.vendor_id === uid && c.unread_by_vendor === true)
            );
            if (hasUnreadMsg) {
                document.querySelectorAll('.msg-dot').forEach(dot => dot.style.display = 'block');
            }
        }

        // Notification Check (Placeholder for when you build the notifications table)
        /* const { data: notifs } = await supabaseClient.from('notifications').select('id').eq('user_id', uid).eq('is_read', false).limit(1);
        if (notifs && notifs.length > 0) {
            document.querySelectorAll('.notify-dot').forEach(dot => dot.style.display = 'block');
        }
        */
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

// --- FETCH ITEMS ---
async function fetchItems() {
    const grid = document.getElementById('product-grid');
    if (!grid) return; // Prevent errors on pages without this grid
    try {
        const { data: products, error } = await supabaseClient
            .from('products')
            .select('id, name, price, image_urls, category')
            .eq('status', 'Active')
            .limit(100);

        if (error) throw error;
        grid.innerHTML = ""; 

        if (products.length === 0) {
            grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: #888;">No items posted yet.</p>`;
            return;
        }

        const randomItems = shuffleArray(products).slice(0, 50);

        randomItems.forEach(p => {
            const imgUrl = (p.image_urls && p.image_urls.length > 0) ? p.image_urls[0] : 'https://via.placeholder.com/300?text=No+Image';
            const formattedPrice = new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(p.price);

            grid.innerHTML += `
                <div class="card" onclick="window.location.href='product/index.html?id=${p.id}'">
                    <img src="${imgUrl}" class="card-img" onerror="this.src='https://via.placeholder.com/300'">
                    <div class="card-price">${formattedPrice}</div>
                    <div style="width: 100%; overflow: hidden;">
                        <div class="card-title">${p.name}</div>
                        <div class="card-desc">${p.category}</div>
                    </div>
                </div>
            `;
        });
    } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: red;">Failed to load items.</p>`; }
}

// --- FETCH VENDORS ---
async function fetchVendors() {
    const grid = document.getElementById('vendor-grid');
    if (!grid) return;
    try {
        const { data: vendors, error } = await supabaseClient
            .from('vendors')
            .select('id, business_name, description, logo_url, subscription_plan')
            .eq('is_active', true)
            .limit(100);

        if (error) throw error;
        grid.innerHTML = "";

        if (vendors.length === 0) {
            grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: #888;">No vendors registered yet.</p>`;
            return;
        }

        const randomVendors = shuffleArray(vendors).slice(0, 30);

        randomVendors.forEach(v => {
            const logo = v.logo_url || "https://via.placeholder.com/100";
            const nameTxt = v.business_name ? v.business_name : 'Unknown';
            const descTxt = v.description ? v.description.substring(0, 25) + '...' : 'Verified Seller';

            let badgeColor = "#38bdf8"; 
            if (v.subscription_plan === "Influencer") badgeColor = "#fbbf24"; 
            if (v.subscription_plan === "Icon") badgeColor = "#1e293b"; 

            // 🚀 FIX: Updated Link to Clean Profile URL
            grid.innerHTML += `
                <div class="card" style="text-align: center; display: flex; flex-direction: column; align-items: center; height: 100%;" onclick="window.location.href='vendors/profile/?id=${v.id}'">
                    <img src="${logo}" style="width: 60px; height: 60px; border-radius: 50%; margin: 0 auto 10px; flex-shrink: 0; object-fit: cover;" onerror="this.src='https://via.placeholder.com/100'">
                    <div style="width: 100%; overflow: hidden;">
                        <div style="font-size: 13px; font-weight: 800; color: #1e293b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
                            ${nameTxt} <i class="fas fa-check-circle" style="color: ${badgeColor};"></i>
                        </div>
                        <div style="margin-top: 5px; font-size: 11px; color: #64748b; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${descTxt}</div>
                    </div>
                </div>
            `;
        });
    } catch (error) { grid.innerHTML = `<p style="grid-column: span 2; text-align: center; color: red;">Failed to load vendors.</p>`; }
}

// --- FETCH REVIEWS ---
async function fetchReviews() {
    const slider = document.getElementById('reviews-slider');
    if(!slider) return;
    try {
        const { data, error } = await supabaseClient
            .from('reviews')
            .select('rating, review_text, profiles(full_name, avatar_url)')
            .eq('status', 'approved')
            .limit(20);

        if (error) throw error;
        slider.innerHTML = "";

        if (data.length === 0) {
            slider.innerHTML = "<p style='padding:20px; color:#94a3b8; font-size:13px;'>No reviews yet.</p>";
            return;
        }

        const randomReviews = shuffleArray(data).slice(0, 5);

        randomReviews.forEach(r => {
            const name = r.profiles?.full_name || "Student";
            const avatar = r.profiles?.avatar_url || "img/person.png";
            
            slider.innerHTML += `
                <div class="review-card">
                    <div class="rev-header">
                        <img src="${avatar}" class="rev-img" onerror="this.src='../img/person.png'">
                        <div>
                            <div class="rev-name">${name} <i class="fas fa-check-circle" style="color: #10b981; font-size:10px;"></i></div>
                            <div class="rev-stars">${'<i class="fas fa-star"></i>'.repeat(r.rating)}</div>
                        </div>
                    </div>
                    <div class="rev-text">"${r.review_text}"</div>
                </div>
            `;
        });

        startReviewSlider();
    } catch (error) { slider.innerHTML = "<p style='padding:20px; color:red;'>Failed to load reviews.</p>"; }
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

// --- FETCH BLOGS ---
async function fetchBlogs() {
    const list = document.getElementById('blog-list');
    if (!list) return;
    try {
        const { data, error } = await supabaseClient
            .from('blogs')
            .select('id, title, snippet, category, image_url, created_at')
            .order('created_at', { ascending: false })
            .limit(5);

        if (error) throw error;
        list.innerHTML = "";

        if (data.length === 0) {
            list.innerHTML = "<p style='text-align:center; color:#94a3b8; font-size:13px;'>No news updates yet.</p>";
            return;
        }

        data.forEach(b => {
            const imgUrl = b.image_url || 'https://via.placeholder.com/100';
            const niceSlug = b.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '') + '--' + b.id;
            const postDate = new Date(b.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

            list.innerHTML += `
                <div class="blog-card" onclick="window.location.href='blogs/index.html?post=${niceSlug}'">
                    <img src="${imgUrl}" class="blog-img" onerror="this.src='https://via.placeholder.com/100'">
                    <div class="blog-info">
                        <div class="blog-cat-row">
                            <div class="blog-cat">${b.category || 'News'}</div>
                            <div class="blog-date">${postDate}</div>
                        </div>
                        <div class="blog-title">${b.title}</div>
                        <div class="blog-desc">${b.snippet}</div>
                    </div>
                </div>
            `;
        });
    } catch (error) { list.innerHTML = "<p style='text-align:center; color:red;'>Failed to load news.</p>"; }
}

// 🚀 EXACT JIJI FOOTER LOGIC
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

window.downloadApp = function() {
    alert("🚀 Preparing UNICAL Market PWA Download...");
}

// =========================================
// 🌙 GLOBAL DARK MODE LOGIC
// =========================================

// 1. Immediately apply the theme when the script loads on ANY page
// This checks the browser memory. If it says "dark", it makes the page dark.
if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark-mode');
}

// 2. Inject the Toggle Button ONLY on the main page
document.addEventListener("DOMContentLoaded", () => {
    // We only look for '.header-top', which only exists on your main index.html page
    const headerTop = document.querySelector('.header-top');
    
    // If '.header-top' exists, it means we are on the main page, so we build the button
    if (headerTop) {
        const themeBtn = document.createElement('button');
        themeBtn.className = "theme-toggle-btn";
        
        // Set the initial icon
        const isDark = document.body.classList.contains('dark-mode');
        themeBtn.innerHTML = isDark ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        
        // Style the button
        themeBtn.style.cssText = 'background:none; border:none; font-size:22px; color:var(--brand-color); cursor:pointer; margin-left: auto; margin-right: 15px; transition: 0.2s;';
        
        // What happens when you click it
        themeBtn.onclick = function() {
            const darkModeActive = document.body.classList.toggle('dark-mode');
            
            // Save the preference to browser memory so other pages know about it
            localStorage.setItem('theme', darkModeActive ? 'dark' : 'light');
            
            // Swap the icon
            themeBtn.innerHTML = darkModeActive ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>';
        };
        
        // Place the button next to the notification bell
        const notifyIcon = document.querySelector('.notify-icon-container');
        if (notifyIcon) {
            headerTop.insertBefore(themeBtn, notifyIcon);
        } else {
            headerTop.appendChild(themeBtn);
        }
    }
});