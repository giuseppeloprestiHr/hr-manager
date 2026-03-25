"""
HR Manager - Script di minificazione
Uso: python minify.py
     python minify.py --ripristina
"""
import re, os, shutil, sys

SRC = 'index.html'
MIN = 'index.min.html'
BAK = 'index.src.html'

def minify(text):
    placeholders = {}
    idx = [0]

    def save_block(m):
        key = f'__BLOCK_{idx[0]}__'
        placeholders[key] = m.group(0)
        idx[0] += 1
        return key

    # Preserva blocchi <style> intatti
    text = re.sub(r'<style[\s\S]*?</style>', save_block, text, flags=re.IGNORECASE)

    # Salva blocchi <script> per minificarli separatamente
    scripts = []
    def save_script(m):
        key = f'__SCRIPT_{len(scripts)}__'
        scripts.append(m.group(0))
        return key
    text = re.sub(r'<script[\s\S]*?</script>', save_script, text, flags=re.IGNORECASE)

    # Rimuovi commenti HTML
    text = re.sub(r'<!--[\s\S]*?-->', '', text)
    # Comprimi spazi HTML
    text = re.sub(r'>\s+<', '><', text)
    text = re.sub(r'\n\s*\n', '\n', text)
    text = re.sub(r'  +', ' ', text)
    text = text.strip()

    # Minifica ogni blocco script
    for i, script in enumerate(scripts):
        key = f'__SCRIPT_{i}__'
        # Rimuovi righe di commento standalone (// testo)
        script = re.sub(r'\n[ \t]*//[^\n]*', '', script)
        # Rimuovi commenti /* ... */ (eccetto quelli con @license o @preserve)
        script = re.sub(r'/\*(?![@!])[\s\S]*?\*/', '', script)
        # Rimuovi righe vuote multiple
        script = re.sub(r'\n{3,}', '\n\n', script)
        # Rimuovi spazi prima/dopo operatori comuni
        script = re.sub(r'[ \t]+\n', '\n', script)
        text = text.replace(key, script)

    # Reinserisci blocchi style
    for key, val in placeholders.items():
        text = text.replace(key, val)

    return text

def main():
    if not os.path.exists(SRC):
        print(f'Errore: {SRC} non trovato.')
        return

    with open(SRC, 'r', encoding='utf-8') as f:
        original = f.read()

    size_orig = len(original.encode('utf-8'))
    print(f'Sorgente:    {size_orig:>8,} byte  ({SRC})')

    minified = minify(original)

    with open(MIN, 'w', encoding='utf-8') as f:
        f.write(minified)

    size_min = len(minified.encode('utf-8'))
    risparmio = (1 - size_min / size_orig) * 100
    print(f'Minificato:  {size_min:>8,} byte  ({MIN})')
    print(f'Risparmio:   {risparmio:.1f}%')

    # Backup sorgente e sostituisci con minificato
    shutil.copy(SRC, BAK)
    shutil.copy(MIN, SRC)
    os.remove(MIN)

    print(f'\nFatto!')
    print(f'  {BAK}  = sorgente originale (con commenti)')
    print(f'  {SRC}       = versione minificata (pronta per push)')
    print(f'\nDopo il push, ripristina con:')
    print(f'  python minify.py --ripristina')

def ripristina():
    if not os.path.exists(BAK):
        print(f'Errore: backup {BAK} non trovato.')
        return
    shutil.copy(BAK, SRC)
    os.remove(BAK)
    print(f'Ripristinato: {SRC} dal backup {BAK}')

if __name__ == '__main__':
    if '--ripristina' in sys.argv:
        ripristina()
    else:
        main()
