import { supabase } from '../supabase'; // Adjust this path to point to your client setup

/**
 * Multi-Tenant Diaspora SMS Notification Simulator Engine
 */
export const notificationService = {
  
  /**
   * Dispatches and logs simulated SMS messages based on individual institution rules
   * @param {Object} params
   * @param {string} params.institutionId - Owner of the transaction
   * @param {string} params.transactionId - Linked transaction log reference
   * @param {string} params.funeralId - Connected deceased profile reference
   * @param {string} params.donorName - Display name of the contributor
   * @param {string} params.fullPhoneNumber - Formatted dial string e.g., "+233244123456"
   * @param {number} params.amount - Numeric contribution
   * @param {string} params.currency - GHS, USD, EUR, etc.
   * @param {string} params.reference - Your custom tenant reference string (e.g., KUMA-2026-X)
   * @param {string} params.deceasedName - Name of the deceased for receipt phrasing
   * @param {string} params.institutionName - Name of the church/institution
   */
  sendDonationSMS: async ({
    institutionId,
    transactionId,
    funeralId,
    donorName,
    fullPhoneNumber,
    amount,
    currency,
    reference,
    deceasedName,
    institutionName
  }) => {
    try {
      console.log(`%c[SMS Engine] Initiating notification verification pipeline for reference: ${reference}...`, 'color: #bc9c22');

      // 1. FETCH THE TENANT'S NOTIFICATION PREFERENCES
      const { data: settings, error: settingsError } = await supabase
        .from('notification_settings')
        .select('*')
        .eq('institution_id', institutionId)
        .maybeSingle();

      if (settingsError) {
        console.error('[SMS Engine Error] Failed fetching settings profiles:', settingsError);
        return { success: false, reason: 'Settings read failure' };
      }

      // If settings row doesn't exist, we default to enabled for safety or skip it
      const isSMSEnabled = settings ? settings.sms_enabled : true;

      if (!isSMSEnabled) {
        console.log(`%c[SMS Engine] Skipped. SMS alerts disabled in settings for institution: ${institutionName}`, 'color: #ef4444');
        return { success: true, status: 'skipped_by_settings' };
      }

      // 2. COMPOSE THE DIASPORA LOCALIZED SMS TEXT CONTENT
      const messageText = `Thank you ${donorName} for your donation of ${amount} ${currency} towards the funeral of the late ${deceasedName}. Ref: ${reference}. Powered by ${institutionName}.`;

      // 3. INITIALIZE LOG entries with 'pending' status inside your tables
      // Insert into master notification log
      const { data: notificationRow, error: notifError } = await supabase
        .from('notifications')
        .insert([{
          institution_id: institutionId,
          transaction_id: transactionId,
          funeral_id: funeralId,
          channel: 'sms',
          recipient: fullPhoneNumber,
          message: messageText,
          status: 'pending',
          provider: 'SMS_SIMULATOR_V1',
          retry_count: 0
        }])
        .select()
        .single();

      if (notifError) throw notifError;

      // Insert into detailed low-level SMS logs table
      const { data: smsLogRow, error: logError } = await supabase
        .from('sms_logs')
        .insert([{
          institution_id: institutionId,
          transaction_id: transactionId,
          phone: fullPhoneNumber,
          message: messageText,
          status: 'pending',
          provider: 'SMS_SIMULATOR_V1'
        }])
        .select()
        .single();

      if (logError) throw logError;

      // 4. SIMULATE EXTERNAL GATEWAY NETWORK LATENCY DELAY (1.5 seconds)
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Simulate a 95% success delivery rate for realistic network environment metrics
      const isGatewaySuccessful = Math.random() > 0.05; 

      if (isGatewaySuccessful) {
        const timestampNow = new Date().toISOString();

        // Update notifications table status
        await supabase
          .from('notifications')
          .update({ 
            status: 'sent', 
            sent_at: timestampNow 
          })
          .eq('id', notificationRow.id);

        // Update sms_logs table status
        await supabase
          .from('sms_logs')
          .update({ status: 'delivered' })
          .eq('id', smsLogRow.id);

        // Print out a terminal notification mock wrapper summary
        console.log(`
%c====================================================
📱 SIMULATED SMS WIRE TRANSMISSION SUCCESS
====================================================
To:       ${fullPhoneNumber}
Message:  ${messageText}
Status:   Delivered Successfully
Gateway:  SMS_SIMULATOR_V1
====================================================`, 'color: #10b981; font-weight: bold;');

        return { success: true, status: 'delivered' };

      } else {
        // Handle API/Gateway network timeout drops gracefully
        const gatewayErrorMessage = 'Network Timeout: Remote provider base station unreachable.';

        await supabase
          .from('notifications')
          .update({ status: 'failed', error: gatewayErrorMessage })
          .eq('id', notificationRow.id);

        await supabase
          .from('sms_logs')
          .update({ status: 'failed', error: gatewayErrorMessage })
          .eq('id', smsLogRow.id);

        console.error(`[SMS Engine] Simulated Gateway Failure for ${fullPhoneNumber}: ${gatewayErrorMessage}`);
        return { success: false, status: 'failed', reason: gatewayErrorMessage };
      }

    } catch (globalCatchError) {
      console.error('[SMS Engine Severe Exception]:', globalCatchError);
      return { success: false, error: globalCatchError.message };
    }
  }
};