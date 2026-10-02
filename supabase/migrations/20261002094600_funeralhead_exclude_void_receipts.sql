BEGIN;
CREATE OR REPLACE FUNCTION public.legacycloud_funeralhead_contributions()
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path='' AS $$
DECLARE funeral public.funerals%ROWTYPE; contributions jsonb;
BEGIN
 IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Sign in to view your funeral dashboard' USING ERRCODE='42501'; END IF;
 SELECT f.* INTO funeral FROM public.funerals f
 WHERE f.manager_id=auth.uid() OR to_jsonb(f)->>'funeral_head_id'=auth.uid()::text
 ORDER BY to_jsonb(f)->>'created_at' DESC NULLS LAST,f.id DESC LIMIT 1;
 IF NOT FOUND THEN RETURN jsonb_build_object('funeral',NULL,'transactions','[]'::jsonb); END IF;
 SELECT coalesce(jsonb_agg(jsonb_build_object('id',t.id,'donor_name',t.donor_name,'amount',t.amount,
   'currency',t.currency,'created_at',t.created_at) ORDER BY t.created_at DESC,t.id),'[]'::jsonb)
 INTO contributions FROM public.transactions t
 WHERE t.funeral_id=funeral.id
   AND lower(btrim(coalesce(to_jsonb(t)->>'status',''))) NOT IN ('void','voided')
   AND lower(coalesce(to_jsonb(t)->>'is_void','false')) NOT IN ('true','1')
   AND NOT EXISTS (
     SELECT 1 FROM public.voided_transactions v
     WHERE nullif(btrim(t.reference),'') IS NOT NULL AND btrim(v.reference)=btrim(t.reference)
   );
 RETURN jsonb_build_object('funeral',jsonb_build_object('id',funeral.id,'full_name',funeral.full_name),
   'transactions',contributions);
END $$;
REVOKE ALL ON FUNCTION public.legacycloud_funeralhead_contributions() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.legacycloud_funeralhead_contributions() TO authenticated;
COMMIT;
NOTIFY pgrst,'reload schema';
