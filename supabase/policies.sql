-- Enable Row Level Security
ALTER TABLE "public"."wpp_chats" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "public"."wpp_rules" ENABLE ROW LEVEL SECURITY;

-- Policies for wpp_chats
CREATE POLICY "Enable insert for users on wpp_chats" ON "public"."wpp_chats" FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Enable select for users on wpp_chats" ON "public"."wpp_chats" FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Enable update for users on wpp_chats" ON "public"."wpp_chats" FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Enable delete for users on wpp_chats" ON "public"."wpp_chats" FOR DELETE TO authenticated USING (auth.uid() = user_id);

-- Policies for wpp_rules
CREATE POLICY "Enable all for users on wpp_rules" ON "public"."wpp_rules" FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
