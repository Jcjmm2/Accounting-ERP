using System.Collections.Concurrent;

namespace Tyted.API.Services
{
    /// <summary>
    /// Control de intentos fallidos de login (anti fuerza bruta a nivel de
    /// CUENTA, complementario al rate limiting por IP del middleware).
    /// Tras <see cref="MaxIntentos"/> fallos consecutivos dentro de la ventana,
    /// el usuario queda bloqueado durante <see cref="DuracionBloqueo"/>; un
    /// login exitoso reinicia el conteo.
    /// Estado en memoria: la API v1 corre una sola instancia (contenedor único),
    /// por lo que no se necesita persistencia compartida.
    /// </summary>
    public static class LoginBloqueo
    {
        /// <summary>Fallos consecutivos permitidos antes de bloquear.</summary>
        public const int MaxIntentos = 10;

        /// <summary>Ventana en la que cuentan los fallos consecutivos.</summary>
        private static readonly TimeSpan Ventana = TimeSpan.FromMinutes(15);

        /// <summary>Duración del bloqueo tras exceder los intentos.</summary>
        private static readonly TimeSpan DuracionBloqueo = TimeSpan.FromMinutes(15);

        private static readonly ConcurrentDictionary<string, Registro> _registros =
            new(StringComparer.OrdinalIgnoreCase);

        private sealed class Registro
        {
            public int Intentos;
            public DateTime UltimoFalloUtc;
            /// <summary>DateTime.MinValue cuando la cuenta NO está bloqueada.</summary>
            public DateTime BloqueadoHastaUtc = DateTime.MinValue;
        }

        /// <summary>
        /// TRUE si la cuenta está bloqueada; <paramref name="restante"/> indica
        /// el tiempo de bloqueo que queda (TimeSpan.Zero si no está bloqueada).
        /// </summary>
        public static bool EstaBloqueado(string? usuario, out TimeSpan restante)
        {
            restante = TimeSpan.Zero;
            if (string.IsNullOrWhiteSpace(usuario)) return false;
            if (!_registros.TryGetValue(usuario, out var registro)) return false;

            if (registro.BloqueadoHastaUtc > DateTime.UtcNow)
            {
                restante = registro.BloqueadoHastaUtc - DateTime.UtcNow;
                return true;
            }

            // Bloqueo vencido o ventana de fallos expirada: limpia el conteo.
            if (registro.BloqueadoHastaUtc != DateTime.MinValue
                || DateTime.UtcNow - registro.UltimoFalloUtc > Ventana)
            {
                _registros.TryRemove(usuario, out _);
            }
            return false;
        }

        /// <summary>Registra un intento fallido; bloquea al llegar al límite.</summary>
        public static void RegistrarFallo(string? usuario)
        {
            if (string.IsNullOrWhiteSpace(usuario)) return;

            var ahora = DateTime.UtcNow;
            var registro = _registros.GetOrAdd(usuario, _ => new Registro());
            lock (registro)
            {
                // Ventana expirada sin bloqueo vigente: empieza una cuenta limpia.
                if (registro.BloqueadoHastaUtc == DateTime.MinValue
                    && ahora - registro.UltimoFalloUtc > Ventana)
                {
                    registro.Intentos = 0;
                }

                registro.Intentos++;
                registro.UltimoFalloUtc = ahora;
                if (registro.Intentos >= MaxIntentos)
                {
                    registro.BloqueadoHastaUtc = ahora + DuracionBloqueo;
                }
            }
        }

        /// <summary>Reinicia el conteo de fallos (login exitoso).</summary>
        public static void Reiniciar(string? usuario)
        {
            if (string.IsNullOrWhiteSpace(usuario)) return;
            _registros.TryRemove(usuario, out _);
        }
    }
}
