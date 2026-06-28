import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "../supabase";

function DashboardRouter() {
  const navigate = useNavigate();

  useEffect(() => {
    const loadUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        navigate("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("users")
        .select("role_id")
        .eq("id", user.id)
        .single();

      // simple role routing
      if (profile?.role_id === "ADMIN_ROLE_ID") {
        navigate("/admin");
      } else {
        navigate("/cashier");
      }
    };

    loadUser();
  }, []);

  return <p>Loading dashboard...</p>;
}

export default DashboardRouter;