import { expect, test } from '@playwright/test';

/**
 * E2E esenciales: lo que solo un navegador real puede verificar.
 *
 * Las pruebas de integracion ya comprueban que la API rechaza lo que debe.
 * Estas comprueban algo distinto y complementario: que **la interfaz no
 * introduzca por su cuenta una via para saltarse el servidor**, y que los
 * controles del navegador (cookie inaccesible, foco, estados) funcionen de
 * verdad y no solo en el codigo.
 */

const ESTUDIANTE = {
  correo: 'estudiante.a@securecampus.edu.mx',
  contrasena: 'SemillaDesarrollo!2026',
};

test.describe('acceso y sesion', () => {
  test('sin sesion, el panel redirige al login', async ({ page }) => {
    await page.goto('/panel');
    await expect(page).toHaveURL(/\/ingresar/);
  });

  test('las rutas administrativas tampoco son alcanzables sin sesion', async ({ page }) => {
    for (const ruta of ['/panel/usuarios', '/panel/auditoria', '/panel/alertas']) {
      await page.goto(ruta);
      await expect(page, ruta).toHaveURL(/\/ingresar/);
    }
  });

  test('credenciales invalidas no revelan si la cuenta existe', async ({ page }) => {
    await page.goto('/ingresar');

    const intentar = async (correo: string): Promise<string> => {
      await page.getByLabel('Correo institucional').fill(correo);
      await page.getByLabel('Contrasena').fill('ContrasenaIncorrecta1');
      await page.getByRole('button', { name: 'Ingresar' }).click();
      const alerta = page.getByRole('alert').first();
      await expect(alerta).toBeVisible({ timeout: 15_000 });
      return (await alerta.textContent()) ?? '';
    };

    const mensajeInexistente = await intentar('no.existe@securecampus.edu.mx');
    await page.reload();
    const mensajeExistente = await intentar(ESTUDIANTE.correo);

    // El texto debe ser identico. Un mensaje "mas util" en el cliente
    // desharia el control de no enumeracion del servidor (RNFS-016).
    expect(mensajeInexistente.trim()).toBe(mensajeExistente.trim());
  });

  test('el estudiante entra y ve solo lo suyo', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Correo institucional').fill(ESTUDIANTE.correo);
    await page.getByLabel('Contrasena').fill(ESTUDIANTE.contrasena);
    await page.getByRole('button', { name: 'Ingresar' }).click();

    await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });

    const navegacion = page.getByRole('navigation', { name: 'Secciones' });
    await expect(navegacion.getByRole('link', { name: 'Mi perfil' })).toBeVisible();

    // El menu no muestra administracion. Es solo experiencia de usuario: la
    // siguiente prueba verifica que ocultarlo no es lo que protege.
    await expect(navegacion.getByRole('link', { name: 'Usuarios' })).toHaveCount(0);
    await expect(navegacion.getByRole('link', { name: 'Auditoria' })).toHaveCount(0);
  });

  test('la cookie de sesion es inaccesible desde JavaScript', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Correo institucional').fill(ESTUDIANTE.correo);
    await page.getByLabel('Contrasena').fill(ESTUDIANTE.contrasena);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });

    // `HttpOnly` en accion: un XSS no podria robar la sesion (RNFS-012).
    const visible = await page.evaluate(() => document.cookie);
    expect(visible).not.toContain('sc_sesion');
  });

  test('navegar directo a una ruta administrativa no da acceso', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Correo institucional').fill(ESTUDIANTE.correo);
    await page.getByLabel('Contrasena').fill(ESTUDIANTE.contrasena);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });

    // Escribir la URL a mano, que es exactamente lo que hace el escenario 4 de
    // SC-LAB-001: "el endpoint sigue respondiendo a cualquier sesion
    // autenticada que lo invoque directamente".
    await page.goto('/panel/usuarios');

    // La pagina carga, pero la API devuelve 403 y la interfaz lo muestra. No
    // aparece ni un solo dato de otro usuario.
    await expect(page.getByRole('alert')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('cerrar sesion invalida el acceso al volver atras', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Correo institucional').fill(ESTUDIANTE.correo);
    await page.getByLabel('Contrasena').fill(ESTUDIANTE.contrasena);
    await page.getByRole('button', { name: 'Ingresar' }).click();
    await expect(page).toHaveURL(/\/panel/, { timeout: 15_000 });

    await page.getByRole('button', { name: 'Cerrar sesion' }).click();
    await expect(page).toHaveURL(/\/ingresar/, { timeout: 15_000 });

    // El boton "atras" del navegador no debe devolver el acceso: la sesion se
    // revoco en el SERVIDOR, no solo en el cliente.
    await page.goBack();
    await expect(page).toHaveURL(/\/ingresar/, { timeout: 15_000 });
  });
});

test.describe('accesibilidad basica (RNFS-060)', () => {
  test('el formulario de acceso es operable solo con teclado', async ({ page }) => {
    await page.goto('/ingresar');

    // El primer tabulador debe llevar al salto de contenido, y el foco debe
    // ser visible en cada parada.
    await page.keyboard.press('Tab');
    await expect(page.getByRole('link', { name: 'Saltar al contenido principal' })).toBeFocused();

    await page.getByLabel('Correo institucional').focus();
    await page.keyboard.type(ESTUDIANTE.correo);
    await page.keyboard.press('Tab');
    await page.keyboard.type(ESTUDIANTE.contrasena);
    await page.keyboard.press('Tab');
    await expect(page.getByRole('button', { name: 'Ingresar' })).toBeFocused();
  });

  test('los errores de validacion se asocian a su campo', async ({ page }) => {
    await page.goto('/ingresar');
    await page.getByLabel('Correo institucional').fill('no-es-un-correo');
    await page.getByLabel('Contrasena').fill('x');
    await page.getByRole('button', { name: 'Ingresar' }).click();

    const campo = page.getByLabel('Correo institucional');
    await expect(campo).toHaveAttribute('aria-invalid', 'true');

    // Sin `aria-describedby`, un lector de pantalla nunca anuncia el error.
    const describedBy = await campo.getAttribute('aria-describedby');
    expect(describedBy).toBeTruthy();
  });
});
