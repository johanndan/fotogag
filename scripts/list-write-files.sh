#!/bin/bash

# Ausgabedatei
OUTPUT_FILE="code.text"

# Lösche die bestehende Ausgabedatei, falls vorhanden
> "$OUTPUT_FILE"

# Finde alle relevanten Dateien und verarbeite sie
find . -type f \( -name "*.css" -o -name "*.js" -o -name "*.sql" -o -name "*.html" \) | while read -r file; do
    # Dateipfad als Trennlinie schreiben
    echo "===== $file =====" >> "$OUTPUT_FILE"
    # Dateiinhalt anhängen
    cat "$file" >> "$OUTPUT_FILE"
    # Leerzeile für bessere Lesbarkeit
    echo -e "\n" >> "$OUTPUT_FILE"
done

echo "Alle CSS-, JS- und HTML-Dateien wurden in $OUTPUT_FILE gespeichert"