#!/bin/bash

# Colors for better output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_info() {
    echo -e "${BLUE}$1${NC}"
}

print_success() {
    echo -e "${GREEN}$1${NC}"
}

print_warning() {
    echo -e "${YELLOW}$1${NC}"
}

print_error() {
    echo -e "${RED}$1${NC}"
}

# Function to detect Linux distribution
detect_distro() {
    if [ -f /etc/os-release ]; then
        . /etc/os-release
        DISTRO=$ID
        VERSION=$VERSION_ID
    elif [ -f /etc/redhat-release ]; then
        DISTRO="rhel"
    elif [ -f /etc/debian_version ]; then
        DISTRO="debian"
    else
        DISTRO="unknown"
    fi
    
    print_info "Detected distribution: $DISTRO"
}

install_git() {
    print_info "Installing Git..."
    
    case $DISTRO in
        "ubuntu"|"debian"|"pop"|"elementary"|"zorin"|"mint")
            if command -v apt &> /dev/null; then
                sudo apt update
                sudo apt install -y git
            elif command -v apt-get &> /dev/null; then
                sudo apt-get update
                sudo apt-get install -y git
            else
                print_error "APT package manager not found!"
                return 1
            fi
            ;;
        "fedora"|"rhel"|"centos"|"rocky"|"almalinux")
            if command -v dnf &> /dev/null; then
                sudo dnf install -y git
            elif command -v yum &> /dev/null; then
                sudo yum install -y git
            else
                print_error "DNF/YUM package manager not found!"
                return 1
            fi
            ;;
        "opensuse"|"opensuse-leap"|"opensuse-tumbleweed"|"sles")
            if command -v zypper &> /dev/null; then
                sudo zypper install -y git
            else
                print_error "Zypper package manager not found!"
                return 1
            fi
            ;;
        "arch"|"manjaro"|"endeavouros"|"garuda")
            if command -v pacman &> /dev/null; then
                sudo pacman -S --noconfirm git
            elif command -v yay &> /dev/null; then
                yay -S --noconfirm git
            else
                print_error "Pacman package manager not found!"
                return 1
            fi
            ;;
        "alpine")
            if command -v apk &> /dev/null; then
                sudo apk add git
            else
                print_error "APK package manager not found!"
                return 1
            fi
            ;;
        "void")
            if command -v xbps-install &> /dev/null; then
                sudo xbps-install -S git
            else
                print_error "XBPS package manager not found!"
                return 1
            fi
            ;;
        "gentoo")
            if command -v emerge &> /dev/null; then
                sudo emerge --ask=n dev-vcs/git
            else
                print_error "Portage package manager not found!"
                return 1
            fi
            ;;
        *)
            print_error "Unsupported distribution: $DISTRO"
            print_info "Please install Git manually using your distribution's package manager"
            print_info "Or try one of these commands:"
            echo "  Ubuntu/Debian: sudo apt install git"
            echo "  Fedora/RHEL:   sudo dnf install git"
            echo "  openSUSE:      sudo zypper install git"
            echo "  Arch:          sudo pacman -S git"
            echo "  Alpine:        sudo apk add git"
            return 1
            ;;
    esac
}

check_nodejs() {
    if [ -f "package.json" ] && ! command -v npm &> /dev/null; then
        print_warning "package.json found but npm is not installed."
        read -p "Do you want to install Node.js and npm? (y/N): " install_node
        
        if [[ $install_node =~ ^[Yy]$ ]]; then
            print_info "Installing Node.js and npm..."
            
            case $DISTRO in
                "ubuntu"|"debian"|"pop"|"elementary"|"zorin"|"mint")
                    curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
                    sudo apt-get install -y nodejs
                    ;;
                "fedora"|"rhel"|"centos"|"rocky"|"almalinux")
                    curl -fsSL https://rpm.nodesource.com/setup_lts.x | sudo bash -
                    sudo dnf install -y nodejs npm
                    ;;
                "arch"|"manjaro"|"endeavouros"|"garuda")
                    sudo pacman -S --noconfirm nodejs npm
                    ;;
                "opensuse"|"opensuse-leap"|"opensuse-tumbleweed")
                    sudo zypper install -y nodejs npm
                    ;;
                "alpine")
                    sudo apk add nodejs npm
                    ;;
                *)
                    print_warning "Please install Node.js manually for your distribution"
                    ;;
            esac
        fi
    fi
}

clear
print_info "=== Linux Project Update Script ==="
print_info "Detecting system information..."
echo

# Detect distribution
detect_distro
echo

# Check if Git is installed
print_info "Verifying Git installation..."
if command -v git &> /dev/null; then
    print_success "Git found! Version: $(git --version)"
    echo
else
    print_warning "Git not found!"
    echo
    
    read -p "Do you want to install Git automatically? (y/N): " install_git_choice
    
    if [[ $install_git_choice =~ ^[Yy]$ ]]; then
        if install_git; then
            print_success "Git successfully installed!"
            echo
        else
            print_error "Git installation failed!"
            exit 1
        fi
    else
        print_error "Git is required to continue. Please install Git manually."
        exit 1
    fi
fi

# Check if we're in a git repository
if ! git rev-parse --git-dir > /dev/null 2>&1; then
    print_error "Could not find a Git repository in the current directory."
    print_info "Make sure you are in a folder with an initialized Git repository."
    echo
    exit 1
fi

# Show repository information
print_info "Repository: $(git remote get-url origin 2>/dev/null || echo 'No remote origin configured')"
echo

# Show current branch
current_branch=$(git branch --show-current 2>/dev/null)
if [ -n "$current_branch" ]; then
    print_info "Current branch: $current_branch"
else
    print_warning "Could not determine current branch."
fi
echo

# Check for local changes
print_info "Checking for local changes..."
if [ -n "$(git status --porcelain 2>/dev/null)" ]; then
    echo
    print_warning "WARNING: You have local changes in your repository!"
    echo
    git status --short 2>/dev/null
    echo
    
    read -p "Do you want to discard all local changes? (y/N - default is No): " discard_changes
    
    if [[ $discard_changes =~ ^[Yy]$ ]]; then
        echo
        print_info "Discarding local changes..."
        if git checkout . 2>&1; then
            print_success "Local changes discarded successfully!"
        else
            print_error "Error discarding local changes."
            print_info "You may need to resolve this manually."
            echo
            exit 1
        fi
    else
        echo
        print_warning "Keeping local changes. Update cancelled."
        print_info "Please commit, stash, or manually resolve your changes before updating."
        echo
        exit 0
    fi
    echo
fi

# Fetch and pull updates
print_info "Checking for remote changes..."
if git fetch origin 2>&1; then
    print_success "Successfully fetched from remote repository."
else
    print_warning "Warning: Could not fetch from remote repository."
    print_info "Note: Without a successful fetch, 'git pull' will likely fail."
    print_info "Please check your internet connection and remote repository configuration."
    echo
fi

print_info "Updating repository..."
if git pull; then
    echo
    print_success "Repository updated successfully!"
    
    # Check for dependencies and install them
    check_nodejs
    
    if [ -f "package.json" ] && command -v npm &> /dev/null; then
        print_info "Installing npm dependencies..."
        npm install
        echo
    elif [ -f "requirements.txt" ] && command -v pip &> /dev/null; then
        print_info "Installing Python dependencies..."
        pip install -r requirements.txt
        echo
    elif [ -f "Cargo.toml" ] && command -v cargo &> /dev/null; then
        print_info "Building Rust project..."
        cargo build
        echo
    elif [ -f "go.mod" ] && command -v go &> /dev/null; then
        print_info "Installing Go dependencies..."
        go mod download
        echo
    fi
    
else
    echo
    print_error "Error updating the repository."
    print_info "Possible causes:"
    echo "  - No internet connection"
    echo "  - Authentication required"
    echo "  - Merge conflicts"
    echo "  - No remote repository configured"
    echo
    print_info "You may need to resolve conflicts manually or check your credentials."
    exit 1
fi

print_success "All done!"
echo

read -p "Press Enter to continue..."
