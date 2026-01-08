DROP POLICY IF EXISTS "Admins can delete tasks" ON "public"."tasks";

CREATE POLICY "Allow authenticated to delete tasks"
ON "public"."tasks"
FOR DELETE
TO authenticated
USING (true); 