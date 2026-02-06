import os

# Configuration: What to include and what to ignore
INCLUDE_EXTENSIONS = {'.ts', '.tsx', '.js', '.json', '.css', '.html', '.g'}
IGNORE_DIRS = {'node_modules', '.git', 'dist', '.vite'}
IGNORE_FILES = {'package-lock.json', '.env', 'dir.txt'}

def generate_codebase_review(root_dir, output_file):
    with open(output_file, 'w', encoding='utf-8') as outfile:
        for root, dirs, files in os.walk(root_dir):
            # Modify dirs in-place to skip ignored directories
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