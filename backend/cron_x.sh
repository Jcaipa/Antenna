#!/bin/bash
# ⏰ Cron runner for Antenna X/Twitter scraper
# Ejecuta el scraper para perfiles configurados y guarda resultados en DB.
# 
# Uso:
#   ./cron_x.sh                        # ejecuta todos los perfiles
#   ./cron_x.sh @perfil1,@perfil2      # ejecuta perfiles específicos
#
# Agregar a crontab (corre cada 6 horas):
#   0 */6 * * * /Users/antpack/Antenna/backend/cron_x.sh >> /tmp/antenna_cron.log 2>&1

cd "$(dirname "$0")"
source venv/bin/activate

# Perfiles por defecto (separados por coma, sin espacios)
DEFAULT_PROFILES="@samfbiddle"
PROFILES="${1:-$DEFAULT_PROFILES}"

echo ""
echo "═══════════════════════════════════════════════"
echo "⏰ Antenna Cron — $(date)"
echo "═══════════════════════════════════════════════"
echo "Perfiles: $PROFILES"

# Ejecutar scraper
cd services/social
python x_playwright_scraper.py --keywords "$PROFILES" --limit 200 2>&1

if [ $? -eq 0 ]; then
    echo "✅ Scraper completado — $(date)"
    # Enviar email si está configurado
    cd "$(dirname "$0")"
    source venv/bin/activate
    python services/email_notifier.py "${PROFILES%%,*}" 2>&1
else
    echo "❌ Scraper falló — $(date)"
    exit 1
fi