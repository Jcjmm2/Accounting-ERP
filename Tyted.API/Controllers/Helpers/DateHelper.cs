using System;

namespace Tyted.API.Helpers
{
    public static class DateHelper
    {
        // Nombre de la zona horaria para Windows y Linux (Azure/Docker)
        private const string WinZone = "Venezuela Standard Time";
        private const string OssZone = "America/Caracas";

        public static DateTime GetVenezuelaTime()
        {
            TimeZoneInfo tz;
            try
            {
                // Intenta obtener la zona horaria de Windows
                tz = TimeZoneInfo.FindSystemTimeZoneById(WinZone);
            }
            catch (TimeZoneNotFoundException)
            {
                // Si falla (estás en Linux/Docker), intenta con el ID estándar de IANA
                tz = TimeZoneInfo.FindSystemTimeZoneById(OssZone);
            }

            return TimeZoneInfo.ConvertTimeFromUtc(DateTime.UtcNow, tz);
        }

        public static DateTime GetVenezuelaDateOnly()
        {
            // Útil para campos que solo guardan la fecha (sin hora) como la vigencia de la tasa
            return GetVenezuelaTime().Date;
        }
    }
}