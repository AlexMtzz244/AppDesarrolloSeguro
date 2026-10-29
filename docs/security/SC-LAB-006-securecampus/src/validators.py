from decimal import Decimal, InvalidOperation

def validar_calificacion(valor):
    # Nulos y booleanos (bool es subclase de int, hay que rechazarlo antes)
    if valor is None or isinstance(valor, bool):
        raise ValueError("La calificación no puede ser nula ni booleana.")

    # Texto no numérico u otros tipos: Decimal lanza InvalidOperation
    try:
        numero = Decimal(str(valor).strip())
    except (InvalidOperation, ValueError):
        raise ValueError("La calificación debe ser un número válido.")

    # NaN e Infinity sí se convierten a Decimal sin error, así que se revisan aparte
    if not numero.is_finite():
        raise ValueError("La calificación no puede ser NaN ni infinito.")

    if numero < 0 or numero > 100:
        raise ValueError("La calificación debe estar entre 0 y 100.")

    # Más de 2 decimales: se rechaza, no se redondea
    if numero != numero.quantize(Decimal("0.01")):
        raise ValueError("La calificación admite máximo 2 decimales.")

    return numero
