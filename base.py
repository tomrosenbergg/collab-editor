import os
import json
import urllib.request

# Configuration: What to include and what to ignore
INCLUDE_EXTENSIONS = {'.ts', '.tsx', '.js', '.json', '.css', '.html', '.g'}
IGNORE_DIRS = {'node_modules', '.git', 'dist', '.vite'}
IGNORE_FILES = {'package-lock.json', '.env', 'dir.txt', 'base.py'} # Added script to ignore list

# Supabase Config
SUPABASE_URL = 'https://kktvjaujpqejxiqvopwa.supabase.co/rest/v1/rpc/get_schema_dump'
SUPABASE_KEY = 'sb_publishable_mE97Q9kBgo-eulQGtx3HHw_ur0aFNh4'

def fetch_db_schema():
    """Triggers the Supabase RPC and returns formatted JSON string."""
    print("Fetching database schema from Supabase...")
    headers = {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json"
    }
    req = urllib.request.Request(SUPABASE_URL, method="POST", headers=headers)
    
    try:
        with urllib.request.urlopen(req) as response:
            data = json.loads(response.read().decode())
            return json.dumps(data, indent=2)
    except Exception as e:
        return f"ERROR FETCHING SCHEMA: {e}"

def generate_codebase_review(root_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as outfile:
        # --- PHASE 1: Database Schema ---
        outfile.write(f"{'='*80}\n")
        outfile.write("DATABASE SCHEMA (Supabase Dump)\n")
        outfile.write(f"{'='*80}\n\n")
        outfile.write(fetch_db_schema())
        outfile.write("\n\n")

        # --- PHASE 2: Project Files ---
        for root, dirs, files in os.walk(root_dir):
            dirs[:] = [d for d in dirs if d not in IGNORE_DIRS]

            for file in files:
                if file in IGNORE_FILES:
                    continue
                
                ext = os.path.splitext(file)[1]
                if ext in INCLUDE_EXTENSIONS:
                    file_path = os.path.join(root, file)
                    relative_path = os.path.relpath(file_path, root_dir)
                    
                    outfile.write(f"\n{'='*80}\n")
                    outfile.write(f"FILE: {relative_path}\n")
                    outfile.write(f"{'='*80}\n\n")
                    
                    try:
                        with open(file_path, 'r', encoding='utf-8') as f:
                            outfile.write(f.read())
                            outfile.write("\n")
                    except Exception as e:
                        outfile.write(f"ERROR READING FILE: {e}\n")

if __name__ == "__main__":
    generate_codebase_review('.', 'project_for_review.txt')
    print("Review file generated: project_for_review.txt")