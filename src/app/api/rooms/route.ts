import { NextRequest, NextResponse } from 'next/server';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

export async function GET() {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const { data, error } = await supabase
      .from('rooms')
      .select('*')
      .order('room_number');

    if (error) throw error;
    return NextResponse.json(data || []);
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { room_number, building_name, capacity, room_type, facilities } = body;

    if (!room_number) {
      return NextResponse.json({ success: false, error: 'room_number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rooms')
      .insert({ room_number, building_name, capacity, room_type, facilities, is_active: true })
      .select()
      .single();

    if (error) {
      if (error.message.includes('duplicate') || error.message.includes('unique')) {
        return NextResponse.json({ success: false, error: 'Room already exists' }, { status: 409 });
      }
      throw error;
    }

    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const body = await request.json();
    const { room_number, ...updates } = body;

    if (!room_number) {
      return NextResponse.json({ success: false, error: 'room_number is required' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('rooms')
      .update(updates)
      .eq('room_number', room_number)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ success: true, data });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    if (!isSupabaseConfigured()) {
      return NextResponse.json({ success: false, error: 'Supabase not configured' }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const room_number = searchParams.get('room_number');

    if (!room_number) {
      return NextResponse.json({ success: false, error: 'room_number is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('rooms')
      .delete()
      .eq('room_number', room_number);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
