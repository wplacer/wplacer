// =================== KEYBOARD SHORTCUTS & AUTO-REFRESH ===================
// This file contains improvements to the main wplacer interface

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    // Don't trigger shortcuts when typing in inputs
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        return;
    }

    // Ctrl/Cmd key combinations
    if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
            case '1':
                e.preventDefault();
                if (currentTab !== 'main') changeTab('main');
                break;
            case '2':
                e.preventDefault();
                openManageUsers.click();
                break;
            case '3':
                e.preventDefault();
                openAddTemplate.click();
                break;
            case '4':
                e.preventDefault();
                openManageTemplates.click();
                break;
            case '5':
                e.preventDefault();
                openLogsViewer.click();
                break;
            case '6':
                e.preventDefault();
                openSettings.click();
                break;
        }
    }

    // ESC key to go back to main or close modals
    if (e.key === 'Escape') {
        if (!messageBoxOverlay.classList.contains('hidden')) {
            messageBoxCancel.click();
        } else if (currentTab !== 'main') {
            changeTab('main');
        }
    }

    // ? key to show help
    if (e.key === '?' && !e.shiftKey) {
        e.preventDefault();
        showMessage('Keyboard Shortcuts', `
            <div style="text-align: left; line-height: 1.8;">
                <b>Navigation:</b><br>
                Ctrl+1: Main Menu<br>
                Ctrl+2: Manage Users<br>
                Ctrl+3: Add Template<br>
                Ctrl+4: Manage Templates<br>
                Ctrl+5: View Logs<br>
                Ctrl+6: Settings<br><br>
                <b>Other:</b><br>
                ESC: Go back / Close dialogs<br>
                ?: Show this help<br>
            </div>
        `);
    }
});

// =================== LAYOUT STABILITY FIX ===================

// Enhanced main menu reset function
const enhancedResetMainMenu = () => {
    const mainElement = document.getElementById('main');
    if (mainElement && currentTab === 'main') {
        // Force reset any external modifications
        mainElement.removeAttribute('style');

        // Apply our grid layout with highest priority
        mainElement.style.cssText = `
            display: grid !important;
            grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)) !important;
            gap: 16px !important;
            margin: 32px 0 !important;
            max-width: 900px !important;
            margin-left: auto !important;
            margin-right: auto !important;
            width: 100% !important;
            box-sizing: border-box !important;
            flex-direction: row !important;
            flex-wrap: wrap !important;
        `;

        // Force re-render
        mainElement.offsetHeight;

        // Reset all buttons
        const buttons = mainElement.querySelectorAll('button');
        buttons.forEach(button => {
            button.removeAttribute('style');
            button.style.cssText = `
                width: 100% !important;
                display: inline-flex !important;
                align-items: center !important;
                justify-content: center !important;
                flex: none !important;
            `;
        });
    }
};

// Override the original changeTab function
const originalChangeTab = window.changeTab;
if (originalChangeTab) {
    window.changeTab = function(tabName) {
        // Call original function
        originalChangeTab(tabName);

        // Apply our enhancements
        if (tabName === 'main') {
            setTimeout(() => {
                enhancedResetMainMenu();
            }, 50);
        }
    };
}

// Monitor for layout changes and fix them
const layoutObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.type === 'attributes' && mutation.attributeName === 'style') {
            const target = mutation.target;
            if (target.id === 'main' && currentTab === 'main') {
                // Main element style was modified, fix it
                setTimeout(() => {
                    enhancedResetMainMenu();
                }, 10);
            }
        }
    });
});

// Start observing the main element
const mainElement = document.getElementById('main');
if (mainElement) {
    layoutObserver.observe(mainElement, {
        attributes: true,
        attributeFilter: ['style', 'class']
    });
}

// Periodic layout check (fallback)
setInterval(() => {
    if (currentTab === 'main') {
        const mainEl = document.getElementById('main');
        if (mainEl) {
            const computedStyle = window.getComputedStyle(mainEl);
            if (computedStyle.display !== 'grid') {
                console.log('🔧 Layout drift detected, fixing...');
                enhancedResetMainMenu();
            }
        }
    }
}, 5000);

// Global notification function
window.notify = function(message, type = 'info', duration = 4000) {
    const createNotificationArea = () => {
        const notificationArea = document.createElement('div');
        notificationArea.id = 'notification-area';
        notificationArea.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(notificationArea);
        return notificationArea;
    };

    const area = document.getElementById('notification-area') || createNotificationArea();

    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.style.cssText = `
        background: var(--background-secondary);
        border: 1px solid var(--border-color);
        border-radius: 8px;
        padding: 12px 16px;
        margin-bottom: 8px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        opacity: 0;
        transform: translateX(100%);
        transition: all 0.3s ease;
        pointer-events: auto;
        max-width: 300px;
        word-wrap: break-word;
        font-family: var(--font-family);
        font-size: 0.9rem;
        color: var(--text-primary);
        cursor: pointer;
    `;

    // Type-specific styling
    if (type === 'success') {
        notification.style.borderLeftColor = 'var(--success-color)';
        notification.style.borderLeftWidth = '4px';
    } else if (type === 'error') {
        notification.style.borderLeftColor = 'var(--error-color)';
        notification.style.borderLeftWidth = '4px';
    } else if (type === 'warning') {
        notification.style.borderLeftColor = 'var(--warning-color)';
        notification.style.borderLeftWidth = '4px';
    }

    notification.textContent = message;
    area.appendChild(notification);

    // Show
    setTimeout(() => {
        notification.style.opacity = '1';
        notification.style.transform = 'translateX(0)';
    }, 100);

    // Auto-hide
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    }, duration);

    // Click to dismiss
    notification.addEventListener('click', () => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
        setTimeout(() => notification.remove(), 300);
    });
};

console.log('🎨 wplacer UI improvements loaded successfully!');
console.log('✅ Layout stability enhanced');
console.log('✅ Extension conflict protection active');