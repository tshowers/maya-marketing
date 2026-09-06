export function normalizePhoneDigits ( value: unknown ): string {
  return String( value || '' ).replace( /\D/g, '' );
}

export function buildPhoneLookupKeys ( values: Array<unknown> ): string[] {
  const keys = new Set<string>();

  values.forEach( value => {
    const digits = normalizePhoneDigits( value );
    if ( !digits ) return;

    keys.add( digits );

    if ( digits.length === 11 && digits.startsWith( '1' ) ) {
      keys.add( digits.slice( 1 ) );
    }

    if ( digits.length === 10 ) {
      keys.add( `1${digits}` );
    }
  } );

  return Array.from( keys );
}
