import subprocess
import pandas as pd
import os
import time

def run_script(script_name):
    """Ejecuta un script de Python y retorna si fue exitoso."""
    print(f"🚀 Ejecutando: {script_name}...")
    try:
        result = subprocess.run(["python3", script_name], capture_output=True, text=True)
        if result.returncode == 0:
            print(f"✅ {script_name} completado con éxito.")
            return True
        else:
            print(f"❌ Error en {script_name}: {result.stderr}")
            return False
    except Exception as e:
        print(f"❌ Excepción al ejecutar {script_name}: {e}")
        return False

def main():
    print("      --- ANTENNA COMPETITIVE INTELLIGENCE ---")
    print(f"Fecha: {time.strftime('%Y-%m-%d %H:%M:%S')}")
    print("-" * 50)
    
    # 1. Monitoreo de Cambios
    run_script("Competitive Intelligence/competitor_monitor.py")
    
    # 2. Perfil Tecnológico
    run_script("Competitive Intelligence/tech_profiler.py")
    
    # 3. Autoridad de Dominio
    run_script("Competitive Intelligence/authority_check.py")
    
    print("-" * 50)
    print("📈 Inteligencia Competitiva Actualizada.")
    print("Archivos generados:")
    print(" - snapshots/ : Historial de contenido")
    print(" - competitor_tech_stacks.csv : Perfil de tecnologías")
    print(" - competitor_authority.csv : Ranking de autoridad")

if __name__ == "__main__":
    main()
