import os
import subprocess
from pathlib import Path

def get_brave_paths():
    brave_executable = Path(os.getenv("ProgramFiles")) / "BraveSoftware" / "Brave-Browser" / "Application" / "brave.exe"
    user_data_path = Path.home() / "AppData" / "Local" / "BraveSoftware" / "Brave-Browser" / "User Data"
    return brave_executable, user_data_path

def launch_brave_profiles():
    brave_executable, user_data_path = get_brave_paths()

    profile_dirs = [
        d.name for d in user_data_path.iterdir()
        if d.is_dir() and (d.name == "Default" or d.name.startswith("Profile "))
    ]

    for profile in sorted(profile_dirs):
        command = [
            str(brave_executable),
            f'--profile-directory={profile}'
        ]
        subprocess.Popen(command)

if __name__ == "__main__":
    launch_brave_profiles()