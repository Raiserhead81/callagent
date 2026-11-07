package de.gemivo.callagent;

import android.content.Context;
import android.database.Cursor;
import android.net.Uri;
import android.provider.ContactsContract;

/** Kontakt-Pruefung: ist die Nummer im Adressbuch? */
public class ContactHelper {
    public static boolean istBekannt(Context ctx, String nummer) {
        if (nummer == null || nummer.isEmpty()) return false;
        try {
            Uri uri = Uri.withAppendedPath(
                    ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                    Uri.encode(nummer));
            Cursor c = ctx.getContentResolver().query(uri,
                    new String[]{ContactsContract.PhoneLookup._ID}, null, null, null);
            if (c == null) return false;
            boolean da = c.moveToFirst();
            c.close();
            return da;
        } catch (Exception e) {
            return false;
        }
    }
}
